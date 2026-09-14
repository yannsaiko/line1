import React, { useState } from 'react';
import { getSql, detectSchema, loadDictionaries, fetchChatRooms, parseLineTimestamp, formatDateHeader, formatDate, formatTime, parseLineTextFile } from './utils/lineParser';
import { ChatRoom, Message, ParsedFileContext } from './types';

/**
 * タイムスタンプ判定（精度最優先）
 * iOS Mac Cocoa Epoch (秒/ミリ秒) と Unix Epoch (秒/ミリ秒/マイクロ秒) を多角的に検証
 */
const parseExactTimestamp = (rawTime: any): Date | null => {
  if (rawTime === null || rawTime === undefined || rawTime === '') return null;
  if (rawTime instanceof Date && !isNaN(rawTime.getTime())) return rawTime;

  let num = Number(rawTime);
  
  if (!isNaN(num) && num > 0) {
    // 1. iOS Mac Cocoa Epoch (秒単位: 2001-01-01 00:00:00 UTC = +978307200秒)
    // 1億〜20億程度は Cocoa Epoch 秒の可能性が高い
    if (num > 100000000 && num < 2000000000) {
      const unixSec = num + 978307200;
      const d = new Date(unixSec * 1000);
      if (d.getFullYear() >= 2005 && d.getFullYear() <= 2035) return d;
    }

    // 2. iOS Mac Cocoa Epoch (ミリ秒単位)
    if (num > 100000000000000 && num < 2000000000000000) {
      const unixMs = (num / 1000) + (978307200 * 1000);
      const d = new Date(unixMs);
      if (d.getFullYear() >= 2005 && d.getFullYear() <= 2035) return d;
    }

    // 3. Unix Timestamp (ミリ秒単位: 13桁)
    if (num > 1000000000000 && num < 2000000000000) {
      const d = new Date(num);
      if (d.getFullYear() >= 2005 && d.getFullYear() <= 2035) return d;
    }

    // 4. Unix Timestamp (秒単位: 10桁)
    if (num > 1000000000 && num < 2000000000) {
      const d = new Date(num * 1000);
      if (d.getFullYear() >= 2005 && d.getFullYear() <= 2035) return d;
    }

    // 5. マイクロ秒単位の Unix Timestamp (16桁以上)
    if (num > 1000000000000000) {
      const d = new Date(Math.floor(num / 1000));
      if (d.getFullYear() >= 2005 && d.getFullYear() <= 2035) return d;
    }
  }

  // テキスト形式やその他のフォーマット解析
  const fallbackDate = parseLineTimestamp(rawTime);
  if (fallbackDate && !isNaN(fallbackDate.getTime())) return fallbackDate;

  const strDate = new Date(rawTime);
  return !isNaN(strDate.getTime()) ? strDate : null;
};

/**
 * LINE メッセージタイプの高精度ラベル付け
 */
const resolveMessageTypeLabel = (msgType: number, text: string): string => {
  if (text && text.trim().length > 0) return text;

  switch (msgType) {
    case 1: return '📷 [画像]';
    case 2: return '🎥 [動画]';
    case 3: return '🎵 [音声メッセージ]';
    case 6: return '📍 [位置情報]';
    case 7: return '🎨 [スタンプ]';
    case 10: return '📞 [通話履歴]';
    case 14: return '📁 [ファイル]';
    case 16: return '📖 [ノート・アルバム更新]';
    case 18: return '🤝 [連絡先共有]';
    default: return '[メッセージ (スタンプ/メディア/システム)]';
  }
};

export default function App() {
  const [fileMap, setFileMap] = useState<Record<string, ParsedFileContext>>({});
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedFileFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [msgSearchQuery, setMsgSearchQuery] = useState<string>('');
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  // 表示スタイル・モザイク・非表示管理
  const [displayStyle, setDisplayStyle] = useState<'ui' | 'text'>('ui');
  const [blurredRoomKeys, setBlurredRoomKeys] = useState<Set<string>>(new Set());
  const [hiddenRoomKeys, setHiddenRoomKeys] = useState<Set<string>>(new Set());
  const [selectedRoomKeys, setSelectedRoomKeys] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // メッセージ単位のモザイク・非表示キー
  const [blurredMsgKeys, setBlurredMsgKeys] = useState<Set<string>>(new Set());
  const [hiddenMsgKeys, setHiddenMsgKeys] = useState<Set<string>>(new Set());

  // 詳細進捗表示
  const [progress, setProgress] = useState<{ show: boolean; title: string; percent: number }>({ show: false, title: '', percent: 0 });

  const getRoomKey = (room: ChatRoom) => `${room.fileId}_${room.id}`;

  // 高精度ファイル読み込み処理
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setProgress({ show: true, title: 'データベースエンジン (sql.js) を準備中...', percent: 5 });

    try {
      const SQL = await getSql().catch(err => {
        console.error(err);
        throw new Error('WebAssembly (sql.js) の読み込みに失敗しました。');
      });

      const newFileMap: Record<string, ParsedFileContext> = { ...fileMap };
      const newRooms: ChatRoom[] = [...chatRooms];
      let counter = Object.keys(newFileMap).length;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fname = file.name.toLowerCase();

        if (
          fname.startsWith('.') || 
          fname.endsWith('.png') || fname.endsWith('.jpg') || fname.endsWith('.jpeg') || 
          fname.endsWith('.gif') || fname.endsWith('.json') || fname.endsWith('.plist')
        ) {
          continue;
        }

        const currentPercent = Math.round(10 + ((i + 1) / fileList.length) * 85);
        setProgress({ show: true, title: `詳細解析中 (${i + 1}/${fileList.length}): ${file.name}`, percent: currentPercent });

        await new Promise(resolve => setTimeout(resolve, 20));

        counter++;
        const fileId = `file_${counter}`;

        if (fname.endsWith('.txt')) {
          const res = await parseLineTextFile(file, file.name, fileId);
          if (res) {
            newFileMap[fileId] = res.context;
            newRooms.push(res.room);
          }
        } else {
          try {
            const buf = await file.arrayBuffer();
            const db = new SQL.Database(new Uint8Array(buf));
            const schema = detectSchema(db);

            if (schema && schema.msgTable) {
              const { userMap, chatMap } = loadDictionaries(db, schema);
              newFileMap[fileId] = { file, displayLabel: file.name, isText: false, schema, userMap, chatMap };
              const rooms = fetchChatRooms(db, schema, userMap, chatMap, fileId, file.name);

              // トーク部屋名の高精度解決
              const resolvedRooms = rooms.map(r => {
                let resolvedName = r.name;
                if (resolvedName.startsWith('トーク部屋') || resolvedName === '不明なトーク' || !resolvedName.trim()) {
                  if (chatMap[r.id]) resolvedName = chatMap[r.id];
                  else if (userMap[r.id]) resolvedName = userMap[r.id];
                }
                return { ...r, name: resolvedName || 'トーク相手' };
              });

              newRooms.push(...resolvedRooms);
            }
            db.close();
          } catch (e) {
            console.error('ファイル解析スキップ:', file.name, e);
          }
        }
      }

      setFileMap(newFileMap);
      setChatRooms(newRooms);

      if (newRooms.length === 0) {
        alert('解析可能な LINE データベース (`Line.sqlite`) や `.txt` トーク履歴が見つかりませんでした。');
      }
    } catch (err: any) {
      alert(err.message || '解析中にエラーが発生しました。');
    } finally {
      setProgress({ show: false, title: '', percent: 0 });
    }
  };

  // メッセージの解読・名前・時刻の完全補正
  const selectChatRoom = async (room: ChatRoom) => {
    if (isBatchMode) {
      toggleRoomSelection(getRoomKey(room));
      return;
    }

    setActiveChat(room);
    setMsgSearchQuery('');
    setHighlightedMsgId(null);

    const fileCtx = fileMap[room.fileId];
    if (!fileCtx) return;

    if (fileCtx.isText && fileCtx.messages) {
      setMessages(fileCtx.messages);
      return;
    }

    try {
      const SQL = await getSql();
      const buf = await fileCtx.file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      const sch = fileCtx.schema;
      if (!sch) return;

      const safeId = String(room.id).replace(/'/g, "''");

      const query = `
        SELECT "${sch.textCol}", ${sch.isMeCol ? `"${sch.isMeCol}"` : 'NULL'}, "${sch.senderCol}", "${sch.timeCol}", "${sch.typeCol || sch.textCol}"
        FROM "${sch.msgTable}"
        WHERE CAST("${sch.chatCol}" AS TEXT) = '${safeId}'
        ORDER BY "${sch.timeCol}" ASC
      `;

      const res = db.exec(query)[0];
      db.close();

      if (!res || !res.values) {
        setMessages([]);
        return;
      }

      let detectedPartnerName = '';

      // メッセージデータの精密変換
      const parsedMsgs: Message[] = res.values.map((r, idx) => {
        const rawText = r[0];
        const isMeVal = r[1];
        const senderId = String(r[2] !== null && r[2] !== undefined ? r[2] : '').trim();
        const rawTime = r[3];
        const msgType = Number(r[4]);

        let isMe = false;
        if (isMeVal !== null && isMeVal !== undefined) {
          isMe = (Number(isMeVal) === 1 || String(isMeVal) === '1');
        } else {
          isMe = (!senderId || senderId === '0' || senderId === '' || senderId === 'null');
        }

        const formattedText = resolveMessageTypeLabel(msgType, String(rawText || ''));

        // 送信者名の精度向上処理
        let senderName = '';
        if (isMe) {
          senderName = '自分';
        } else {
          if (fileCtx.userMap?.[senderId]) senderName = fileCtx.userMap[senderId];
          else if (fileCtx.chatMap?.[room.id]) senderName = fileCtx.chatMap[room.id];
          else if (fileCtx.chatMap?.[senderId]) senderName = fileCtx.chatMap[senderId];

          if (senderName && senderName !== '相手' && senderName !== '自分') {
            detectedPartnerName = senderName;
          }
        }

        // 精密タイムスタンプ変換
        const dateObj = parseExactTimestamp(rawTime);

        return {
          id: idx,
          text: formattedText,
          isMe,
          senderId,
          senderName: senderName || '相手',
          timeOnlyStr: dateObj ? formatTime(dateObj) : '00:00',
          dateStr: dateObj ? formatDateHeader(dateObj) : '日付不明',
          fullDateTimeStr: dateObj ? `${formatDate(dateObj)} ${formatTime(dateObj)}` : '日付不明',
          timestamp: dateObj ? dateObj.getTime() : 0
        };
      });

      // タイムスタンプ順に確定ソート
      parsedMsgs.sort((a, b) => a.timestamp - b.timestamp);

      // 部屋名・相手の表記の最終補完
      const finalPartnerName = detectedPartnerName || fileCtx.chatMap?.[room.id] || (room.name && !room.name.startsWith('トーク部屋') ? room.name : 'トーク相手');

      parsedMsgs.forEach(m => {
        if (!m.isMe && (m.senderName === '相手' || !m.senderName)) {
          m.senderName = finalPartnerName;
        }
      });

      if (room.name.startsWith('トーク部屋') || room.name === '不明なトーク') {
        const updatedRoom = { ...room, name: finalPartnerName };
        setActiveChat(updatedRoom);
        setChatRooms(prev => prev.map(r => (r.id === room.id && r.fileId === room.fileId ? updatedRoom : r)));
      }

      setMessages(parsedMsgs);
    } catch (e) {
      console.error('メッセージ取得エラー:', e);
    }
  };

  const scrollToMessage = (msgId: number) => {
    setHighlightedMsgId(msgId);
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedMsgId(prev => (prev === msgId ? null : prev));
    }, 2500);
  };

  const toggleRoomSelection = (key: string) => {
    setSelectedRoomKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const batchToggleBlur = (blur: boolean) => {
    setBlurredRoomKeys(prev => {
      const next = new Set(prev);
      selectedRoomKeys.forEach(k => (blur ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  const batchHideRooms = () => {
    if (!window.confirm(`選択した ${selectedRoomKeys.size} 件のトーク部屋を非表示（リストから削除）にしますか？`)) return;
    setHiddenRoomKeys(prev => {
      const next = new Set(prev);
      selectedRoomKeys.forEach(k => next.add(k));
      return next;
    });
    setSelectedRoomKeys(new Set());
    if (activeChat && selectedRoomKeys.has(getRoomKey(activeChat))) {
      setActiveChat(null);
    }
  };

  const toggleMessageBlur = (msgKey: string) => {
    setBlurredMsgKeys(prev => {
      const next = new Set(prev);
      if (next.has(msgKey)) next.delete(msgKey);
      else next.add(msgKey);
      return next;
    });
  };

  const hideMessage = (msgKey: string) => {
    setHiddenMsgKeys(prev => {
      const next = new Set(prev);
      next.add(msgKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRoomKeys.size === filteredRooms.length) {
      setSelectedRoomKeys(new Set());
    } else {
      setSelectedRoomKeys(new Set(filteredRooms.map(getRoomKey)));
    }
  };

  const filteredRooms = chatRooms.filter(r => {
    const key = getRoomKey(r);
    if (hiddenRoomKeys.has(key)) return false;
    const matchFile = selectedFileFilter === 'ALL' || r.fileId === selectedFileFilter;
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFile && matchSearch;
  });

  const currentRoomKey = activeChat ? getRoomKey(activeChat) : '';
  const visibleMessages = messages.filter(m => !hiddenMsgKeys.has(`${currentRoomKey}_${m.id}`));

  const searchResults = msgSearchQuery.trim()
    ? visibleMessages.filter(m => m.text.toLowerCase().includes(msgSearchQuery.toLowerCase()))
    : [];

  const isCurrentActiveBlurred = activeChat ? blurredRoomKeys.has(currentRoomKey) : false;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#f5f5f5' }}>
      {/* ヘッダー */}
      <header style={{ background: '#06c755', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '18px', margin: 0 }}>LINE トーク履歴マルチビューア (高精度解析モード)</h1>
        {Object.keys(fileMap).length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setShowSettingsModal(true)} 
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ⚙️ 設定
            </button>
            <button 
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }} 
              onClick={() => window.location.reload()}
            >
              リセット
            </button>
          </div>
        )}
      </header>

      {/* ファイルドロップ・選択画面 */}
      {Object.keys(fileMap).length === 0 ? (
        <div 
          onDragOver={e => e.preventDefault()} 
          onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
          style={{ flex: 1, border: '3px dashed #06c755', margin: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}
        >
          <h2>LINE バックアップファイルまたはフォルダーをドロップ</h2>
          <p style={{ color: '#666', marginTop: '8px' }}>`Line.sqlite` データベースや `.txt` トーク履歴ファイルを読み込みます</p>

          {progress.show && (
            <div style={{ margin: '16px 0', padding: '12px 24px', background: '#e8f8ee', borderRadius: '8px', border: '1px solid #06c755', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: '#06c755', marginBottom: '6px' }}>{progress.title}</div>
              <div style={{ fontSize: '14px', color: '#333' }}>{progress.percent}%</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <label style={{ background: '#06c755', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              📄 ファイルを選択
              <input 
                type="file" 
                multiple 
                onClick={e => ((e.target as HTMLInputElement).value = '')}
                onChange={e => e.target.files && handleFileUpload(e.target.files)} 
                style={{ display: 'none' }} 
              />
            </label>

            <label style={{ background: '#0084ff', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              📁 フォルダーを選択
              <input 
                type="file" 
                {...({ webkitdirectory: '', directory: '' } as any)} 
                multiple 
                onClick={e => ((e.target as HTMLInputElement).value = '')}
                onChange={e => e.target.files && handleFileUpload(e.target.files)} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
        </div>
      ) : (
        /* メインビューアー */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 左側：トーク一覧 */}
          <div style={{ width: '340px', background: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="トーク部屋名で検索..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={() => { setIsBatchMode(!isBatchMode); setSelectedRoomKeys(new Set()); }}
                  style={{ background: isBatchMode ? '#ff9800' : '#f0f0f0', color: isBatchMode ? '#fff' : '#333', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {isBatchMode ? '一括選択を終了' : '☑ 一括操作'}
                </button>

                {isBatchMode && (
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', color: '#0084ff', cursor: 'pointer', fontSize: '12px' }}>
                    {selectedRoomKeys.size === filteredRooms.length ? '全解除' : 'すべて選択'}
                  </button>
                )}
              </div>

              {isBatchMode && selectedRoomKeys.size > 0 && (
                <div style={{ display: 'flex', gap: '6px', background: '#fff3e0', padding: '6px', borderRadius: '6px', border: '1px solid #ffe0b2' }}>
                  <button onClick={() => batchToggleBlur(true)} style={{ flex: 1, background: '#795548', color: '#fff', border: 'none', padding: '4px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                    🌫 モザイク
                  </button>
                  <button onClick={() => batchToggleBlur(false)} style={{ flex: 1, background: '#a1887f', color: '#fff', border: 'none', padding: '4px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                    解除
                  </button>
                  <button onClick={batchHideRooms} style={{ flex: 1, background: '#f44336', color: '#fff', border: 'none', padding: '4px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                    🗑 削除
                  </button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredRooms.map(room => {
                const roomKey = getRoomKey(room);
                const isSelected = selectedRoomKeys.has(roomKey);
                const isBlurred = blurredRoomKeys.has(roomKey);

                return (
                  <div 
                    key={roomKey}
                    onClick={() => selectChatRoom(room)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: activeChat?.id === room.id && activeChat?.fileId === room.fileId ? '#e8f8ee' : '#fff'
                    }}
                  >
                    {isBatchMode && (
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => toggleRoomSelection(roomKey)}
                        onClick={e => e.stopPropagation()} 
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', filter: isBlurred ? 'blur(4px)' : 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name}</span>
                        {isBlurred && <span style={{ fontSize: '10px', background: '#e0e0e0', padding: '2px 4px', borderRadius: '3px', flexShrink: 0 }}>ぼかし</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{room.count}件</span>
                        <span>{room.lastTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右側：トークエリア */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: displayStyle === 'ui' ? '#abc1ee' : '#fff' }}>
            {activeChat ? (
              <>
                <div style={{ background: '#fff', padding: '10px 16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', filter: isCurrentActiveBlurred ? 'blur(5px)' : 'none' }}>
                      {activeChat.name}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#666' }}>{visibleMessages.length}件のメッセージ</span>
                  </div>

                  <button 
                    onClick={() => {
                      setBlurredRoomKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(currentRoomKey)) next.delete(currentRoomKey);
                        else next.add(currentRoomKey);
                        return next;
                      });
                    }}
                    style={{ background: isCurrentActiveBlurred ? '#795548' : '#f0f0f0', color: isCurrentActiveBlurred ? '#fff' : '#333', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    {isCurrentActiveBlurred ? '👁️ モザイク解除' : '🌫️ 全体モザイク'}
                  </button>

                  <div style={{ flex: 1, maxWidth: '300px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="text" 
                      placeholder="🔍 トーク内容を検索..." 
                      value={msgSearchQuery} 
                      onChange={e => setMsgSearchQuery(e.target.value)} 
                      style={{ flex: 1, padding: '6px 12px', borderRadius: '16px', border: '1px solid #ccc', fontSize: '13px' }}
                    />
                    {msgSearchQuery && (
                      <button 
                        onClick={() => setMsgSearchQuery('')} 
                        style={{ background: '#bbb', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={() => window.print()} 
                    style={{ background: '#06c755', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🖨️ 印刷
                  </button>
                </div>

                {/* 検索結果表示 */}
                {msgSearchQuery.trim() && (
                  <div style={{ background: '#fff9c4', padding: '8px 16px', borderBottom: '1px solid #fbc02d', maxHeight: '140px', overflowY: 'auto', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#574300' }}>
                      検索結果: {searchResults.length}件 (クリックで対象メッセージへ移動)
                    </div>
                    {searchResults.length === 0 ? (
                      <div style={{ color: '#888' }}>該当するメッセージが見つかりません</div>
                    ) : (
                      searchResults.map(m => (
                        <div 
                          key={`search_${m.id}`}
                          onClick={() => scrollToMessage(m.id)}
                          style={{
                            padding: '4px 8px',
                            margin: '2px 0',
                            background: '#fff',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: '1px solid #ffe082',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '10px' }}>
                            <strong>{m.senderName}:</strong> {m.text}
                          </span>
                          <span style={{ fontSize: '10px', color: '#888', flexShrink: 0 }}>{m.fullDateTimeStr}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 本文エリア */}
                {displayStyle === 'ui' ? (
                  /* LINE UI 風 */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {visibleMessages.map((m, idx) => {
                      const showDate = idx === 0 || visibleMessages[idx - 1].dateStr !== m.dateStr;
                      const isHighlighted = highlightedMsgId === m.id;
                      const msgKey = `${currentRoomKey}_${m.id}`;
                      const isMsgBlurred = isCurrentActiveBlurred || blurredMsgKeys.has(msgKey);

                      return (
                        <React.Fragment key={m.id}>
                          {showDate && (
                            <div style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.8)', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: '#444' }}>
                              {m.dateStr}
                            </div>
                          )}
                          <div 
                            id={`msg-${m.id}`}
                            style={{ 
                              alignSelf: m.isMe ? 'flex-end' : 'flex-start', 
                              maxWidth: '75%', 
                              display: 'flex', 
                              flexDirection: 'column',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            <span style={{ fontSize: '11px', color: '#444', marginBottom: '2px', textAlign: m.isMe ? 'right' : 'left' }}>
                              {m.senderName}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: m.isMe ? 'row-reverse' : 'row' }}>
                              <div style={{
                                background: isHighlighted ? '#fff59d' : (m.isMe ? '#85e249' : '#fff'),
                                color: '#000',
                                padding: '8px 12px',
                                borderRadius: '14px',
                                fontSize: '14px',
                                boxShadow: isHighlighted ? '0 0 10px #fbc02d' : '0 1px 2px rgba(0,0,0,0.1)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                filter: isMsgBlurred ? 'blur(5px)' : 'none',
                                outline: isHighlighted ? '2px solid #fbc02d' : 'none'
                              }}>
                                {m.text}
                              </div>

                              {/* メッセージ単位のモザイク・削除ボタン */}
                              <div style={{ display: 'flex', gap: '2px', opacity: 0.7 }}>
                                <button 
                                  title={blurredMsgKeys.has(msgKey) ? "モザイク解除" : "モザイク適用"} 
                                  onClick={() => toggleMessageBlur(msgKey)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
                                >
                                  {blurredMsgKeys.has(msgKey) ? '👁️' : '🌫️'}
                                </button>
                                <button 
                                  title="このメッセージを削除" 
                                  onClick={() => hideMessage(msgKey)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)', marginTop: '2px', textAlign: m.isMe ? 'right' : 'left' }}>
                              {m.fullDateTimeStr}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  /* テキスト風 */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontFamily: 'monospace', background: '#fff', fontSize: '13px', lineHeight: '1.6', color: '#222' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '16px', borderBottom: '2px solid #333', paddingBottom: '8px', filter: isCurrentActiveBlurred ? 'blur(5px)' : 'none' }}>
                      [LINE] {activeChat.name}とのトーク履歴
                    </div>
                    {visibleMessages.map((m, idx) => {
                      const showDate = idx === 0 || visibleMessages[idx - 1].dateStr !== m.dateStr;
                      const isHighlighted = highlightedMsgId === m.id;
                      const msgKey = `${currentRoomKey}_${m.id}`;
                      const isMsgBlurred = isCurrentActiveBlurred || blurredMsgKeys.has(msgKey);

                      return (
                        <div key={m.id} id={`msg-${m.id}`}>
                          {showDate && (
                            <div style={{ fontWeight: 'bold', margin: '16px 0 8px 0', color: '#555' }}>
                              {m.dateStr}
                            </div>
                          )}
                          <div style={{ 
                            padding: '2px 6px', 
                            background: isHighlighted ? '#fff59d' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ filter: isMsgBlurred ? 'blur(4px)' : 'none' }}>
                              {m.timeOnlyStr || '00:00'} <strong style={{ margin: '0 8px' }}>{m.senderName}:</strong> {m.text}
                            </span>
                            
                            <button 
                              title="モザイク切替" 
                              onClick={() => toggleMessageBlur(msgKey)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                            >
                              {blurredMsgKeys.has(msgKey) ? '👁️' : '🌫️'}
                            </button>
                            <button 
                              title="メッセージを削除" 
                              onClick={() => hideMessage(msgKey)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ margin: 'auto', background: 'rgba(255,255,255,0.8)', padding: '20px', borderRadius: '12px', fontWeight: 'bold', color: '#555' }}>
                左のリストからトークを選択してください
              </div>
            )}
          </div>
        </div>
      )}

      {/* 設定ダイアログ */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '450px', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>⚙️ アプリ設定</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>💬 表示形式</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setDisplayStyle('ui')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: displayStyle === 'ui' ? '#06c755' : '#ccc',
                    background: displayStyle === 'ui' ? '#e8f8ee' : '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📱 LINEアプリ風
                </button>
                <button 
                  onClick={() => setDisplayStyle('text')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: displayStyle === 'text' ? '#06c755' : '#ccc',
                    background: displayStyle === 'text' ? '#e8f8ee' : '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📄 公式テキスト風
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🛡️ 状態の復元・再表示</label>
              <div style={{ fontSize: '13px', color: '#555', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>モザイク中の部屋: {blurredRoomKeys.size}件</span>
                  {blurredRoomKeys.size > 0 && (
                    <button onClick={() => setBlurredRoomKeys(new Set())} style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      すべて解除
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>非表示中の部屋: {hiddenRoomKeys.size}件</span>
                  {hiddenRoomKeys.size > 0 && (
                    <button onClick={() => setHiddenRoomKeys(new Set())} style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      すべて再表示
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>個別にモザイク中のメッセージ: {blurredMsgKeys.size}件</span>
                  {blurredMsgKeys.size > 0 && (
                    <button onClick={() => setBlurredMsgKeys(new Set())} style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      すべて解除
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>個別に削除中のメッセージ: {hiddenMsgKeys.size}件</span>
                  {hiddenMsgKeys.size > 0 && (
                    <button onClick={() => setHiddenMsgKeys(new Set())} style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      すべて再表示
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '12px' }}>
              <button 
                onClick={() => setShowSettingsModal(false)} 
                style={{ background: '#06c755', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
