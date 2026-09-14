import React, { useState } from 'react';
import { getSql, detectSchema, loadDictionaries, fetchChatRooms, parseLineTimestamp, formatDateHeader, formatDate, formatTime, parseLineTextFile } from './utils/lineParser';
import { ChatRoom, Message, ParsedFileContext } from './types';

export default function App() {
  const [fileMap, setFileMap] = useState<Record<string, ParsedFileContext>>({});
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedFileFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [msgSearchQuery, setMsgSearchQuery] = useState<string>('');
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  
  // 表示設定・モザイク・削除（非表示）管理
  const [displayStyle, setDisplayStyle] = useState<'ui' | 'text'>('ui'); // 'ui' = 吹き出し, 'text' = 公式テキスト風
  const [blurredRoomKeys, setBlurredRoomKeys] = useState<Set<string>>(new Set()); // モザイク設定された部屋
  const [hiddenRoomKeys, setHiddenRoomKeys] = useState<Set<string>>(new Set()); // 非表示(削除)された部屋
  const [selectedRoomKeys, setSelectedRoomKeys] = useState<Set<string>>(new Set()); // 一括選択中の部屋
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false); // 一括選択モードフラグ
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false); // 設定ダイアログ表示フラグ

  // UI状態
  const [progress, setProgress] = useState<{ show: boolean; title: string; percent: number }>({ show: false, title: '', percent: 0 });

  // 部屋の一意のキーを生成 (fileId + id)
  const getRoomKey = (room: ChatRoom) => `${room.fileId}_${room.id}`;

  // ファイル / フォルダーのアップロード処理
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setProgress({ show: true, title: 'データベースエンジン (sql.js) を準備中...', percent: 10 });

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
        setProgress({ show: true, title: `解析中 (${i + 1}/${fileList.length}): ${file.name}`, percent: currentPercent });

        await new Promise(resolve => setTimeout(resolve, 10));

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
              newRooms.push(...rooms);
            }
            db.close();
          } catch (e) {
            // スキップ
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

  // トーク部屋選択時のメッセージ読み込み
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

        let text = String(rawText || '');
        if (!text.trim()) {
          if (msgType === 1) text = '[📷 画像]';
          else if (msgType === 2) text = '[🎥 動画]';
          else if (msgType === 3) text = '[🎵 音声メッセージ]';
          else if (msgType === 6) text = '[📍 位置情報]';
          else if (msgType === 7) text = '[🎨 スタンプ]';
          else text = '[メッセージ (スタンプ/写真/システム)]';
        }

        // 送信者名の補正
        let senderName = '相手';
        if (isMe) {
          senderName = '自分';
        } else if (fileCtx.userMap?.[senderId]) {
          senderName = fileCtx.userMap[senderId];
        } else if (fileCtx.chatMap?.[room.id]) {
          senderName = fileCtx.chatMap[room.id];
        } else if (room.name && !room.name.startsWith('トーク部屋')) {
          senderName = room.name;
        }

        const dateObj = parseLineTimestamp(rawTime);

        return {
          id: idx,
          text,
          isMe,
          senderId,
          senderName,
          timeOnlyStr: dateObj ? formatTime(dateObj) : '',
          dateStr: dateObj ? formatDateHeader(dateObj) : '日付不明',
          fullDateTimeStr: dateObj ? `${formatDate(dateObj)} ${formatTime(dateObj)}` : '日付不明',
          timestamp: dateObj ? dateObj.getTime() : 0
        };
      });

      setMessages(parsedMsgs);
    } catch (e) {
      console.error(e);
    }
  };

  // 該当のメッセージへスクロール＆ハイライト表示
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

  // 一括選択の切り替え
  const toggleRoomSelection = (key: string) => {
    setSelectedRoomKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 一括モザイク適用/解除
  const batchToggleBlur = (blur: boolean) => {
    setBlurredRoomKeys(prev => {
      const next = new Set(prev);
      selectedRoomKeys.forEach(k => (blur ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  // 一括非表示 (削除)
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

  // 全選択・全解除
  const toggleSelectAll = () => {
    if (selectedRoomKeys.size === filteredRooms.length) {
      setSelectedRoomKeys(new Set());
    } else {
      setSelectedRoomKeys(new Set(filteredRooms.map(getRoomKey)));
    }
  };

  const filteredRooms = chatRooms.filter(r => {
    const key = getRoomKey(r);
    if (hiddenRoomKeys.has(key)) return false; // 非表示済みの部屋を除外
    const matchFile = selectedFileFilter === 'ALL' || r.fileId === selectedFileFilter;
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFile && matchSearch;
  });

  const searchResults = msgSearchQuery.trim()
    ? messages.filter(m => m.text.toLowerCase().includes(msgSearchQuery.toLowerCase()))
    : [];

  const isCurrentActiveBlurred = activeChat ? blurredRoomKeys.has(getRoomKey(activeChat)) : false;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#f5f5f5' }}>
      {/* ヘッダー */}
      <header style={{ background: '#06c755', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '18px', margin: 0 }}>LINE トーク履歴マルチビューア</h1>
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

      {/* ファイル選択画面 */}
      {Object.keys(fileMap).length === 0 ? (
        <div 
          onDragOver={e => e.preventDefault()} 
          onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
          style={{ flex: 1, border: '3px dashed #06c755', margin: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}
        >
          <h2>ファイルまたはフォルダーをドロップ</h2>
          <p style={{ color: '#666', marginTop: '8px' }}>`Line.sqlite` や `.txt` バックアップファイルをドロップするか選択してください</p>

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
        /* ビューアー画面 */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 左側：トーク部屋一覧 */}
          <div style={{ width: '340px', background: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
            {/* 検索・一括選択ツールバー */}
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="トーク部屋名で絞り込み..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={() => { setIsBatchMode(!isBatchMode); setSelectedRoomKeys(new Set()); }}
                  style={{ background: isBatchMode ? '#ff9800' : '#f0f0f0', color: isBatchMode ? '#fff' : '#333', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {isBatchMode ? '一括選択を終了' : '☑ 一括編集'}
                </button>

                {isBatchMode && (
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', color: '#0084ff', cursor: 'pointer', fontSize: '12px' }}>
                    {selectedRoomKeys.size === filteredRooms.length ? '選択解除' : 'すべて選択'}
                  </button>
                )}
              </div>

              {/* 一括操作ボタンパネル */}
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

            {/* 部屋リスト */}
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

          {/* 右側：トーク本文エリア */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: displayStyle === 'ui' ? '#abc1ee' : '#fff' }}>
            {activeChat ? (
              <>
                {/* メインヘッダー＆トーク内検索 */}
                <div style={{ background: '#fff', padding: '10px 16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', filter: isCurrentActiveBlurred ? 'blur(5px)' : 'none' }}>
                      {activeChat.name}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#666' }}>{messages.length}件のメッセージ</span>
                  </div>

                  {/* モザイク個別切替ボタン */}
                  <button 
                    onClick={() => {
                      const key = getRoomKey(activeChat);
                      setBlurredRoomKeys(prev => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                    style={{ background: isCurrentActiveBlurred ? '#795548' : '#f0f0f0', color: isCurrentActiveBlurred ? '#fff' : '#333', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    {isCurrentActiveBlurred ? '👁️ モザイク解除' : '🌫️ このトークをモザイク'}
                  </button>

                  {/* トーク本文検索フィルター */}
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

                {/* 検索結果パネル */}
                {msgSearchQuery.trim() && (
                  <div style={{ background: '#fff9c4', padding: '8px 16px', borderBottom: '1px solid #fbc02d', maxHeight: '140px', overflowY: 'auto', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#574300' }}>
                      検索結果: {searchResults.length}件 (クリックで該当メッセージへ移動)
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
                            justify: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '10px', filter: isCurrentActiveBlurred ? 'blur(4px)' : 'none' }}>
                            <strong>{m.senderName}:</strong> {m.text}
                          </span>
                          <span style={{ fontSize: '10px', color: '#888', flexShrink: 0 }}>{m.fullDateTimeStr}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* メッセージ表示エリア (UIスタイル / テキストスタイル 切替) */}
                {displayStyle === 'ui' ? (
                  /* LINEアプリ風 (吹き出し) 表示 */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.map((m, idx) => {
                      const showDate = idx === 0 || messages[idx - 1].dateStr !== m.dateStr;
                      const isHighlighted = highlightedMsgId === m.id;

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
                              maxWidth: '70%', 
                              display: 'flex', 
                              flexDirection: 'column',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            <span style={{ fontSize: '11px', color: '#444', marginBottom: '2px', textAlign: m.isMe ? 'right' : 'left', filter: isCurrentActiveBlurred ? 'blur(4px)' : 'none' }}>
                              {m.senderName}
                            </span>
                            <div style={{
                              background: isHighlighted ? '#fff59d' : (m.isMe ? '#85e249' : '#fff'),
                              color: '#000',
                              padding: '8px 12px',
                              borderRadius: '14px',
                              fontSize: '14px',
                              boxShadow: isHighlighted ? '0 0 10px #fbc02d' : '0 1px 2px rgba(0,0,0,0.1)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              filter: isCurrentActiveBlurred ? 'blur(5px)' : 'none',
                              outline: isHighlighted ? '2px solid #fbc02d' : 'none'
                            }}>
                              {m.text}
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
                  /* 公式LINEテキストバックアップ風 表示 */
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontFamily: 'monospace', background: '#fff', fontSize: '13px', lineHeight: '1.6', color: '#222' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '16px', borderBottom: '2px solid #333', paddingBottom: '8px', filter: isCurrentActiveBlurred ? 'blur(5px)' : 'none' }}>
                      [LINE] {activeChat.name}とのトーク履歴
                    </div>
                    {messages.map((m, idx) => {
                      const showDate = idx === 0 || messages[idx - 1].dateStr !== m.dateStr;
                      const isHighlighted = highlightedMsgId === m.id;

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
                            filter: isCurrentActiveBlurred ? 'blur(4px)' : 'none' 
                          }}>
                            <span>{m.timeOnlyStr || '00:00'}</span>
                            <span style={{ margin: '0 12px', fontWeight: 'bold' }}>{m.senderName}</span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
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

      {/* 設定モーダルダイアログ */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '450px', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>⚙️ アプリ設定</h3>

            {/* 表示形式設定 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>💬 表示形式の選択</label>
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
                  📱 LINEアプリ風<br/><span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666' }}>（吹き出し画面）</span>
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
                  📄 公式テキスト風<br/><span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666' }}>（バックアップ.txt形式）</span>
                </button>
              </div>
            </div>

            {/* 非表示・モザイク管理設定 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🛡️ モザイク・非表示の管理</label>
              <div style={{ fontSize: '13px', color: '#555', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>モザイク中のトーク部屋: {blurredRoomKeys.size}件</span>
                  {blurredRoomKeys.size > 0 && (
                    <button onClick={() => setBlurredRoomKeys(new Set())} style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      すべて解除
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>非表示(削除)中のトーク部屋: {hiddenRoomKeys.size}件</span>
                  {hiddenRoomKeys.size > 0 && (
                    <button onClick={() => setHiddenRoomKeys(new Set())} style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      すべて再表示
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* モーダル閉じるボタン */}
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
