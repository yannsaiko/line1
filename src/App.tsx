import React, { useState } from 'react';
import { LineDataParser } from './services/lineDataParser';
import { FileUploader } from './components/FileUploader';
import { NormalizedChatRoom, NormalizedMessage } from './types/lineDatabase';

export const App: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<NormalizedChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<NormalizedChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 複数ファイル・フォルダーの統合解析処理
  const handleFilesSelected = async (files: FileList | File[]) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const fileArray = Array.from(files);
      let rawChats: any[] = [];
      let rawUsers: any[] = [];
      let rawMessages: any[] = [];
      let currentUserId = '0';

      // 1. データベースファイル（.sqlite, .db 等）を全て抽出してマージ
      const dbFiles = fileArray.filter(
        (f) =>
          f.name.endsWith('.sqlite') ||
          f.name.endsWith('.sqlite3') ||
          f.name.endsWith('.db') ||
          f.name.includes('Talk') ||
          f.name.includes('Chat')
      );

      if (dbFiles.length > 0) {
        try {
          // @ts-ignore
          const initSqlJs = (await import('sql.js')).default;
          const SQL = await initSqlJs({
            locateFile: () => '',
          });

          for (const dbFile of dbFiles) {
            try {
              const buffer = await dbFile.arrayBuffer();
              const db = new SQL.Database(new Uint8Array(buffer));

              // ZCHAT
              try {
                const chatRes = db.exec('SELECT * FROM ZCHAT');
                if (chatRes.length > 0) {
                  const cols = chatRes[0].columns;
                  const chats = chatRes[0].values.map((row) =>
                    Object.fromEntries(cols.map((col, i) => [col, row[i]]))
                  );
                  rawChats.push(...chats);
                }
              } catch (e) {}

              // ZUSER
              try {
                const userRes = db.exec('SELECT * FROM ZUSER');
                if (userRes.length > 0) {
                  const cols = userRes[0].columns;
                  const users = userRes[0].values.map((row) =>
                    Object.fromEntries(cols.map((col, i) => [col, row[i]]))
                  );
                  rawUsers.push(...users);
                }
              } catch (e) {}

              // ZMESSAGE
              try {
                const msgRes = db.exec('SELECT * FROM ZMESSAGE');
                if (msgRes.length > 0) {
                  const cols = msgRes[0].columns;
                  const msgs = msgRes[0].values.map((row) =>
                    Object.fromEntries(cols.map((col, i) => [col, row[i]]))
                  );
                  rawMessages.push(...msgs);
                }
              } catch (e) {}

              db.close();
            } catch (dbErr) {
              console.warn(`Failed to parse DB: ${dbFile.name}`, dbErr);
            }
          }
        } catch (wasmErr) {
          console.warn('SQLite initialization skipped, falling back to text parsers', wasmErr);
        }
      }

      // 2. テキストファイル（.txt）が複数ある場合も全て読み込んで統合
      const txtFiles = fileArray.filter((f) => f.name.endsWith('.txt'));
      for (const txtFile of txtFiles) {
        try {
          const text = await txtFile.text();
          const lines = text.split('\n');
          const roomTitle = txtFile.name.replace(/\.[^/.]+$/, '');
          
          let fileMessages: any[] = [];
          lines.forEach((line, idx) => {
            const parts = line.split('\t');
            if (parts.length >= 3) {
              fileMessages.push({
                Z_PK: `txt_${txtFile.name}_${idx}`,
                ZTEXT: parts[2],
                ZSENDER: parts[1],
                ZCREATEDTIME: Date.parse(parts[0]) || Date.now(),
              });
            } else if (line.trim() !== '' && fileMessages.length > 0) {
              fileMessages[fileMessages.length - 1].ZTEXT += '\n' + line;
            }
          });

          if (fileMessages.length > 0) {
            rawChats.push({ Z_PK: roomTitle, ZNAME: roomTitle });
            rawMessages.push(...fileMessages);
          }
        } catch (txtErr) {
          console.warn(`Failed to parse text file: ${txtFile.name}`, txtErr);
        }
      }

      const parsedRooms = LineDataParser.parseAllChatRooms(
        rawChats,
        rawUsers,
        rawMessages,
        currentUserId
      );

      if (parsedRooms.length === 0) {
        throw new Error('選択されたファイルから有効なトーク履歴が見つかりませんでした。');
      }

      setChatRooms(parsedRooms);
      setSelectedRoom(parsedRooms[0]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'ファイルの読み込み・解析に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRooms = chatRooms.filter(
    (room) =>
      room.roomTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f5f6f8' }}>
      <header style={{ backgroundColor: '#06C755', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>LINE トーク履歴ビューアー</h1>
        <FileUploader onFilesSelected={handleFilesSelected} isLoading={isLoading} />
      </header>

      {errorMessage && (
        <div style={{ backgroundColor: '#ffdddd', color: '#d8000c', padding: '10px 20px', borderBottom: '1px solid #d8000c', fontSize: '14px' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: '320px', borderRight: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
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
                {chatRooms.length === 0 ? 'ファイルまたはフォルダーを選択してください' : '該当するトークがありません'}
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

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#7494C0' }}>
          {selectedRoom ? (
            <>
              <div style={{ backgroundColor: '#fff', padding: '14px 20px', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                {selectedRoom.roomTitle}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedRoom.messages.length === 0 ? (
                  <div style={{ color: '#fff', textAlign: 'center', marginTop: '40px' }}>メッセージがありません</div>
                ) : (
                  selectedRoom.messages.map((msg: NormalizedMessage, i: number) => (
                    <div
                      key={msg.id || i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.isMyMessage ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {!msg.isMyMessage && (
                        <span style={{ fontSize: '12px', color: '#fff', marginBottom: '3px', marginLeft: '4px' }}>
                          {msg.senderName}
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: msg.isMyMessage ? 'row-reverse' : 'row' }}>
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
                          }}
                        >
                          {msg.text}
                        </div>

                        <span style={{ fontSize: '11px', color: '#e0e0e0', flexShrink: 0 }}>
                          {msg.formattedTime}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px' }}>
              ファイル・フォルダーを読み込むとトーク内容が表示されます
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
