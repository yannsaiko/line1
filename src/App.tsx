import React, { useState, useEffect } from 'react';
import { getSql, detectSchema, loadDictionaries, fetchChatRooms, parseLineTimestamp, formatDateHeader, formatDate, formatTime } from './utils/lineParser';
import { ChatRoom, Message, ParsedFileContext } from './types';

export default function App() {
  const [fileMap, setFileMap] = useState<Record<string, ParsedFileContext>>({});
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // UI状態
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('GitHubからデータを読み込み中...');

  // 起動時にリポジトリ内のデータを自動取得
  useEffect(() => {
    async function loadEmbeddedData() {
      try {
        setLoadingStatus('データベースエンジン (sql.js) を準備中...');
        const SQL = await getSql();

        // 読み込むファイルパスのリスト（public/data/ 以下に置いたファイル）
        // 必要に応じてファイル名を追加してください
        const targetFiles = [
          { path: './data/Line.sqlite', label: 'Line.sqlite' },
          { path: './data/chat.txt', label: 'chat.txt' }
        ];

        const newFileMap: Record<string, ParsedFileContext> = {};
        const newRooms: ChatRoom[] = [];
        let counter = 0;

        for (const target of targetFiles) {
          try {
            setLoadingStatus(`${target.label} をダウンロード中...`);
            const response = await fetch(target.path);
            if (!response.ok) continue; // ファイルが存在しない場合はスキップ

            const blob = await response.blob();
            const file = new File([blob], target.label);
            counter++;
            const fileId = `file_${counter}`;

            if (target.label.endsWith('.txt')) {
              const text = await file.text();
              // テキスト簡易パース
              const lines = text.split(/\r?\n/);
              let title = target.label.replace(/\.txt$/i, '');
              const parsedMsgs: Message[] = [];
              let currentDate = '';
              let currentMsg: Message | null = null;

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const dateMatch = line.match(/^(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})/);
                if (dateMatch && !line.includes('\t')) {
                  currentDate = dateMatch[1];
                  continue;
                }
                const msgMatch = line.match(/^((?:午前|午後|AM|PM\s*)?\d{1,2}:\d{2})\t([^\t]+)\t(.*)/i);
                if (msgMatch) {
                  if (currentMsg) parsedMsgs.push(currentMsg);
                  const isMe = (msgMatch[2].trim() === '自分' || msgMatch[2].trim() === 'Me');
                  currentMsg = {
                    id: parsedMsgs.length,
                    text: msgMatch[3],
                    isMe,
                    senderId: isMe ? 'me' : 'other',
                    senderName: msgMatch[2].trim(),
                    timeOnlyStr: msgMatch[1].trim(),
                    dateStr: currentDate,
                    fullDateTimeStr: currentDate ? `${currentDate} ${msgMatch[1].trim()}` : msgMatch[1].trim(),
                    timestamp: Date.now()
                  };
                } else if (currentMsg) {
                  currentMsg.text += '\n' + line;
                }
              }
              if (currentMsg) parsedMsgs.push(currentMsg);

              if (parsedMsgs.length > 0) {
                newFileMap[fileId] = { file, displayLabel: target.label, isText: true, messages: parsedMsgs };
                newRooms.push({
                  fileId,
                  displayLabel: target.label,
                  id: fileId,
                  name: title,
                  count: parsedMsgs.length,
                  lastTime: parsedMsgs[parsedMsgs.length - 1]?.fullDateTimeStr || '',
                  isText: true
                });
              }
            } else {
              // SQLite
              const buf = await file.arrayBuffer();
              const db = new SQL.Database(new Uint8Array(buf));
              const schema = detectSchema(db);
              if (schema && schema.msgTable) {
                const { userMap, chatMap } = loadDictionaries(db, schema);
                newFileMap[fileId] = { file, displayLabel: target.label, isText: false, schema, userMap, chatMap };
                const rooms = fetchChatRooms(db, schema, userMap, chatMap, fileId, target.label);
                newRooms.push(...rooms);
              }
              db.close();
            }
          } catch (err) {
            console.warn(`[Skip] ${target.label} の読み込みに失敗しました`, err);
          }
        }

        setFileMap(newFileMap);
        setChatRooms(newRooms);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadEmbeddedData();
  }, []);

  // トーク部屋選択時のメッセージ読み込み
  const selectChatRoom = async (room: ChatRoom) => {
    setActiveChat(room);
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
          isMe = (Number(isMeVal) === 1 || isMeVal === true || String(isMeVal) === '1');
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

        let senderName = '相手';
        if (isMe) {
          senderName = '自分';
        } else if (fileCtx.userMap?.[senderId]) {
          senderName = fileCtx.userMap[senderId];
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
          dateStr: dateObj ? formatDateHeader(dateObj) : '日時不明',
          fullDateTimeStr: dateObj ? `${formatDate(dateObj)} ${formatTime(dateObj)}` : '日時不明',
          timestamp: dateObj ? dateObj.getTime() : 0
        };
      });

      setMessages(parsedMsgs);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredRooms = chatRooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#f5f5f5' }}>
      <header style={{ background: '#06c755', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '18px', margin: 0 }}>LINE トーク履歴ビューア (GitHub自動読込版)</h1>
      </header>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
          <div style={{ fontWeight: 'bold', color: '#06c755', fontSize: '16px' }}>{loadingStatus}</div>
        </div>
      ) : chatRooms.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '20px', textAlign: 'center' }}>
          <h3>リポジトリ内にLINEデータが見つかりませんでした</h3>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
            GitHubリポジトリの <b>`public/data/Line.sqlite`</b> にデータベースファイルを配置してください。
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* サイドバー */}
          <div style={{ width: '320px', background: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
              <input 
                type="text" 
                placeholder="トーク部屋を検索..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredRooms.map(room => (
                <div 
                  key={`${room.fileId}_${room.id}`}
                  onClick={() => selectChatRoom(room)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    background: activeChat?.id === room.id && activeChat?.fileId === room.fileId ? '#e8f8ee' : '#fff'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{room.name}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{room.count}件</span>
                    <span>{room.lastTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* メインコンテンツ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#abc1ee' }}>
            {activeChat ? (
              <>
                <div style={{ background: '#fff', padding: '10px 16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>{activeChat.name}</h3>
                    <span style={{ fontSize: '11px', color: '#666' }}>{messages.length}件のメッセージ</span>
                  </div>
                  <button 
                    onClick={() => window.print()} 
                    style={{ background: '#06c755', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🖨️ 印刷
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.map((m, idx) => {
                    const showDate = idx === 0 || messages[idx - 1].dateStr !== m.dateStr;
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && (
                          <div style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.8)', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: '#444' }}>
                            {m.dateStr}
                          </div>
                        )}
                        <div style={{ alignSelf: m.isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', color: '#444', marginBottom: '2px', textAlign: m.isMe ? 'right' : 'left' }}>
                            {m.senderName}
                          </span>
                          <div style={{
                            background: m.isMe ? '#85e249' : '#fff',
                            color: '#000',
                            padding: '8px 12px',
                            borderRadius: '14px',
                            fontSize: '14px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
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
              </>
            ) : (
              <div style={{ margin: 'auto', background: 'rgba(255,255,255,0.8)', padding: '20px', borderRadius: '12px', fontWeight: 'bold', color: '#555' }}>
                左のリストからトークを選択してください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
