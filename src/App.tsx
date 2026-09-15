import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { NormalizedChatRoom, NormalizedMessage } from './types/lineDatabase';

// 文字化け対策（UTF-8 と Shift_JIS を自動判別デコード）
const readTextFile = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('\uFFFD')) {
    try {
      const sjisText = new TextDecoder('shift-jis').decode(buffer);
      if (!sjisText.includes('\uFFFD')) {
        text = sjisText;
      }
    } catch (e) {}
  }
  return text;
};

// 送信時刻・日付の抽出処理
const parseTimestamp = (rawTime: any): { timeStr: string; dateStr: string } => {
  if (rawTime === undefined || rawTime === null || rawTime === '') {
    return { timeStr: '', dateStr: '' };
  }
  let num = Number(rawTime);
  if (!isNaN(num) && num > 0) {
    // Apple Core Data Epoch (2001-01-01基準の秒数) の変換対応
    if (num < 1000000000) {
      num = (num + 978307200) * 1000;
    } else if (num < 100000000000) {
      num = num * 1000;
    }
    const d = new Date(num);
    if (!isNaN(d.getTime())) {
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return { timeStr: `${hours}:${mins}`, dateStr: `${year}/${month}/${day}` };
    }
  }
  const str = String(rawTime).trim();
  const timeMatch = str.match(/(\d{1,2}:\d{2})/);
  return { timeStr: timeMatch ? timeMatch[1] : str, dateStr: '' };
};

export const App: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<NormalizedChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<NormalizedChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 編集状態
  const [blurredMsgIds, setBlurredMsgIds] = useState<Set<string | number>>(new Set());
  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string | number>>(new Set());

  const toggleBlur = (id: string | number) => {
    setBlurredMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteMessage = (id: string | number) => {
    setDeletedMsgIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // LINE TXT解析（iOS / Android / PC全対応）
  const parseLineTxt = (text: string, fileName: string): NormalizedChatRoom | null => {
    const lines = text.split(/\r?\n/);
    let roomTitle = fileName.replace(/\.[^/.]+$/, '').replace(/^\[LINE\]\s*/, '').replace(/とのトーク履歴$/, '');
    const messages: NormalizedMessage[] = [];
    let currentDate = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // ヘッダー・タイトル
      if (trimmed.startsWith('[LINE]')) {
        const match = trimmed.match(/\[LINE\]\s*(.+)とのトーク履歴/);
        if (match) roomTitle = match[1];
        continue;
      }
      if (trimmed.startsWith('保存日時：') || trimmed.startsWith('保存日時:')) continue;

      // 日付行 (2023/10/24(火), 2023.10.24 等)
      const dateMatch = trimmed.match(/^(\d{4}[\/\.\-年]\d{1,2}[\/\.\-月]\d{1,2}[^\s\t]*)/);
      if (dateMatch && !trimmed.includes('\t')) {
        currentDate = dateMatch[1];
        continue;
      }

      // 1) タブ区切り (HH:mm\t送信者\tメッセージ)
      const tabParts = line.split('\t');
      if (tabParts.length >= 3) {
        const timePart = tabParts[0].trim();
        const senderPart = tabParts[1].trim();
        const textPart = tabParts.slice(2).join('\t');
        const isMyMsg = senderPart === '自分' || senderPart === 'Me';

        messages.push({
          id: `txt_${fileName}_${i}`,
          text: textPart,
          senderMid: senderPart,
          senderName: senderPart,
          timestamp: i,
          formattedTime: timePart,
          formattedFullDate: currentDate,
          isMyMessage: isMyMsg,
        });
        continue;
      } else if (tabParts.length === 2) {
        const senderPart = tabParts[0].trim();
        const textPart = tabParts[1];
        const isMyMsg = senderPart === '自分' || senderPart === 'Me';

        messages.push({
          id: `txt_${fileName}_${i}`,
          text: textPart,
          senderMid: senderPart,
          senderName: senderPart,
          timestamp: i,
          formattedTime: '',
          formattedFullDate: currentDate,
          isMyMessage: isMyMsg,
        });
        continue;
      }

      // 2) スペース区切り (Android等: 12:34 送信者 メッセージ)
      const spaceParts = line.split(/\s{2,}/);
      if (spaceParts.length >= 3) {
        const timePart = spaceParts[0].trim();
        const senderPart = spaceParts[1].trim();
        const textPart = spaceParts.slice(2).join(' ');
        const isMyMsg = senderPart === '自分' || senderPart === 'Me';

        messages.push({
          id: `txt_${fileName}_${i}`,
          text: textPart,
          senderMid: senderPart,
          senderName: senderPart,
          timestamp: i,
          formattedTime: timePart,
          formattedFullDate: currentDate,
          isMyMessage: isMyMsg,
        });
        continue;
      }

      // 3) 改行メッセージの継続処理
      if (messages.length > 0) {
        messages[messages.length - 1].text += '\n' + line;
      } else {
        messages.push({
          id: `txt_${fileName}_${i}`,
          text: line,
          senderMid: '送信者',
          senderName: '送信者',
          timestamp: i,
          formattedTime: '',
          formattedFullDate: currentDate,
          isMyMessage: false,
        });
      }
    }

    if (messages.length === 0) return null;

    return {
      chatId: fileName,
      chatMid: fileName,
      roomTitle: roomTitle || 'LINE トーク履歴',
      partner: null,
      messages,
      lastMessageText: messages[messages.length - 1]?.text || '',
      lastMessageTime: messages[messages.length - 1]?.formattedTime || '',
      lastTimestamp: messages.length,
    };
  };

  // ファイル読み込み処理
  const handleFilesSelected = async (files: FileList | File[]) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const fileArray = Array.from(files);
      const parsedRooms: NormalizedChatRoom[] = [];

      for (const file of fileArray) {
        let parsed = false;

        // 1. SQLite DB の解析
        if (
          file.name.endsWith('.sqlite') ||
          file.name.endsWith('.sqlite3') ||
          file.name.endsWith('.db') ||
          file.name.toLowerCase().includes('talk') ||
          file.name.toLowerCase().includes('chat')
        ) {
          try {
            // @ts-ignore
            const initSqlJs = (await import('sql.js')).default;
            const SQL = await initSqlJs({
              locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`,
            });

            const buffer = await file.arrayBuffer();
            const db = new SQL.Database(new Uint8Array(buffer));
            const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
            const tables = tablesRes.length > 0 ? tablesRes[0].values.map((v) => String(v[0])) : [];

            // ユーザーテーブル
            const userMap = new Map<string, string>();
            const userTable = tables.find((t) => t.toLowerCase().includes('user') || t.toLowerCase().includes('contact'));
            if (userTable) {
              const uRes = db.exec(`SELECT * FROM "${userTable}"`);
              if (uRes.length > 0) {
                const cols = uRes[0].columns;
                uRes[0].values.forEach((row) => {
                  const uObj = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
                  const mid = String(uObj.ZMID || uObj.zmid || uObj.Z_PK || uObj.id || '');
                  const name = String(uObj.ZCUSTOMNAME || uObj.zcustomname || uObj.ZNAME || uObj.zname || '');
                  if (mid && name) userMap.set(mid, name);
                });
              }
            }

            // メッセージテーブル
            const msgTable = tables.find((t) => t.toLowerCase().includes('message') || t.toLowerCase().includes('chatlog'));
            if (msgTable) {
              const res = db.exec(`SELECT * FROM "${msgTable}"`);
              if (res.length > 0) {
                const cols = res[0].columns;
                const rows = res[0].values.map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));

                const msgs: NormalizedMessage[] = rows.map((r: any, idx) => {
                  const senderMid = String(r.ZSENDER || r.zsender || r.ZSENDERHEADER || r.zsenderheader || '').trim();
                  const rawTime = r.ZCREATEDTIME ?? r.zcreatedtime ?? r.ZDATE ?? r.zdate ?? r.timestamp;
                  const timeInfo = parseTimestamp(rawTime);

                  const isMyMsg =
                    !senderMid ||
                    senderMid === '0' ||
                    String(r.ZISFROMME || r.zisfromme || '') === '1' ||
                    String(r.ZISFROMME || r.zisfromme || '').toLowerCase() === 'true';

                  let senderName = isMyMsg ? '自分' : '相手';
                  if (!isMyMsg && userMap.has(senderMid)) {
                    senderName = userMap.get(senderMid)!;
                  }

                  return {
                    id: r.Z_PK || r.id || idx,
                    text: String(r.ZTEXT || r.ztext || r.ZBODY || r.zbody || r.text || ''),
                    senderMid,
                    senderName,
                    timestamp: idx,
                    formattedTime: timeInfo.timeStr,
                    formattedFullDate: timeInfo.dateStr,
                    isMyMessage: isMyMsg,
                  };
                });

                parsedRooms.push({
                  chatId: file.name,
                  chatMid: file.name,
                  roomTitle: file.name.replace(/\.[^/.]+$/, ''),
                  partner: null,
                  messages: msgs,
                  lastMessageText: msgs[msgs.length - 1]?.text || '',
                  lastMessageTime: msgs[msgs.length - 1]?.formattedTime || '',
                  lastTimestamp: msgs.length,
                });
                parsed = true;
              }
            }
            db.close();
          } catch (dbErr) {
            console.warn('DB parsing skipped, falling back to text mode', dbErr);
          }
        }

        // 2. テキスト読み込み（UTF-8 & Shift_JIS エンコーディング両対応）
        if (!parsed) {
          try {
            const text = await readTextFile(file);
            const room = parseLineTxt(text, file.name);
            if (room) parsedRooms.push(room);
          } catch (txtErr) {
            console.warn('Text parsing error', txtErr);
          }
        }
      }

      if (parsedRooms.length === 0) {
        throw new Error('有効なトーク履歴データを読み込めませんでした。');
      }

      setChatRooms(parsedRooms);
      setSelectedRoom(parsedRooms[0]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'ファイルの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const currentMessages = selectedRoom
    ? selectedRoom.messages.filter((m) => !deletedMsgIds.has(m.id))
    : [];

  const filteredRooms = chatRooms.filter(
    (room) =>
      room.roomTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f5f6f8' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
          main { background: #fff !important; height: auto !important; overflow: visible !important; }
          .chat-container { height: auto !important; overflow: visible !important; }
          .action-btn { display: none !important; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="no-print" style={{ backgroundColor: '#06C755', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>LINE トーク履歴ビューアー</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {selectedRoom && (
            <button
              onClick={handlePrint}
              style={{ padding: '8px 16px', backgroundColor: '#fff', color: '#06C755', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
            >
              🖨️ 印刷 / PDF保存
            </button>
          )}
          <FileUploader onFilesSelected={handleFilesSelected} isLoading={isLoading} />
        </div>
      </header>

      {errorMessage && (
        <div className="no-print" style={{ backgroundColor: '#ffdddd', color: '#d8000c', padding: '10px 20px', borderBottom: '1px solid #d8000c', fontSize: '14px' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* サイドバー */}
        <aside className="no-print" style={{ width: '320px', borderRight: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              type="text"
              placeholder="トーク部屋やメッセージを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '18px', border: '1px solid #ccc', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredRooms.length === 0 ? (
              <div style={{ padding: '20px', color: '#888', textAlign: 'center', fontSize: '14px' }}>
                {chatRooms.length === 0 ? 'ファイルを選択してください' : '該当するトークがありません'}
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = selectedRoom?.chatId === room.chatId;
                return (
                  <div
                    key={room.chatId}
                    onClick={() => setSelectedRoom(room)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e8f7ed' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333', marginBottom: '4px' }}>
                      {room.roomTitle}
                    </div>
                    <div style={{ fontSize: '13px', color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.lastMessageText || 'メッセージなし'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* トークメイン画面 */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#7494C0' }}>
          {selectedRoom ? (
            <>
              <div style={{ backgroundColor: '#fff', padding: '14px 20px', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '16px', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{selectedRoom.roomTitle}</span>
                <span className="no-print" style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                  ※モザイク・削除で個別編集可能
                </span>
              </div>

              <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentMessages.length === 0 ? (
                  <div style={{ color: '#fff', textAlign: 'center', marginTop: '40px' }}>メッセージがありません</div>
                ) : (
                  currentMessages.map((msg: NormalizedMessage) => {
                    const isBlurred = blurredMsgIds.has(msg.id);

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: msg.isMyMessage ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {msg.formattedFullDate && (
                          <div style={{ alignSelf: 'center', margin: '10px 0', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                            {msg.formattedFullDate}
                          </div>
                        )}

                        {/* 送信者名表示 */}
                        <span style={{ fontSize: '12px', color: '#fff', marginBottom: '3px', marginLeft: msg.isMyMessage ? '0' : '4px', marginRight: msg.isMyMessage ? '4px' : '0' }}>
                          {msg.senderName}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: msg.isMyMessage ? 'row-reverse' : 'row' }}>
                          {/* 吹き出し */}
                          <div
                            style={{
                              maxWidth: '65%',
                              padding: '9px 14px',
                              borderRadius: '16px',
                              backgroundColor: msg.isMyMessage ? '#85E249' : '#FFFFFF',
                              color: '#000',
                              fontSize: '14px',
                              lineHeight: '1.4',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              filter: isBlurred ? 'blur(6px)' : 'none',
                              userSelect: isBlurred ? 'none' : 'auto',
                              transition: 'filter 0.2s',
                            }}
                          >
                            {msg.text}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isMyMessage ? 'flex-end' : 'flex-start', gap: '2px' }}>
                            {/* 送信時刻表示 */}
                            <span style={{ fontSize: '11px', color: '#e0e0e0', flexShrink: 0 }}>
                              {msg.formattedTime || ''}
                            </span>

                            {/* 操作ボタン */}
                            <div className="no-print action-btn" style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => toggleBlur(msg.id)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  backgroundColor: isBlurred ? '#ff9800' : 'rgba(255,255,255,0.8)',
                                  color: isBlurred ? '#fff' : '#333',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                {isBlurred ? '解除' : 'モザイク'}
                              </button>
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  backgroundColor: 'rgba(255,255,255,0.8)',
                                  color: '#d32f2f',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px' }}>
              ファイルを選択するとトーク内容が表示されます
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
