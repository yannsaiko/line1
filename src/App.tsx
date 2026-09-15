import React, { useState } from 'react';
import { LineDataParser } from './services/lineDataParser';
import { FileUploader } from './components/FileUploader';
import { NormalizedChatRoom, NormalizedMessage } from './types/lineDatabase';
import initSqlJs from 'sql.js';

export const App: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<NormalizedChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<NormalizedChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // SQLite DB または TXT ファイルの解析
  const handleFilesSelected = async (files: FileList | File[]) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const fileArray = Array.from(files);
      let rawChats: any[] = [];
      let rawUsers: any[] = [];
      let rawMessages: any[] = [];
      let currentUserId = '0';

      // SQLite DBファイルを優先検索 (.sqlite, .sqlite3, .db)
      const dbFile = fileArray.find(
        (f) =>
          f.name.endsWith('.sqlite') ||
          f.name.endsWith('.sqlite3') ||
          f.name.endsWith('.db') ||
          f.name.includes('Talk')
      );

      if (dbFile) {
        const SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`,
        });
        const buffer = await dbFile.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buffer));

        // ZCHAT テーブル取得
        try {
          const chatRes = db.exec('SELECT * FROM ZCHAT');
          if (chatRes.length > 0) {
            const cols = chatRes[0].columns;
            rawChats = chatRes[0].values.map((row) =>
              Object.fromEntries(cols.map((col, i) => [col, row[i]]))
            );
          }
        } catch (e) {
          console.warn('ZCHAT table not found', e);
        }

        // ZUSER テーブル取得
        try {
          const userRes = db.exec('SELECT * FROM ZUSER');
          if (userRes.length > 0) {
            const cols = userRes[0].columns;
            rawUsers = userRes[0].values.map((row) =>
              Object.fromEntries(cols.map((col, i) => [col, row[i]]))
            );
          }
        } catch (e) {
          console.warn('ZUSER table not found', e);
        }

        // ZMESSAGE テーブル取得
        try {
          const msgRes = db.exec('SELECT * FROM ZMESSAGE');
          if (msgRes.length > 0) {
            const cols = msgRes[0].columns;
            rawMessages = msgRes[0].values.map((row) =>
              Object.fromEntries(cols.map((col, i) => [col, row[i]]))
            );
          }
        } catch (e) {
          console.warn('ZMESSAGE table not found', e);
        }

        db.close();
      }

      const parsedRooms = LineDataParser.parseAllChatRooms(
        rawChats,
        rawUsers,
        rawMessages,
        currentUserId
      );

      if (parsedRooms.length === 0) {
        throw new Error('有効なトーク履歴データが見つかりませんでした。');
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

  // 検索フィルタリング
  const filteredRooms = chatRooms.filter(
    (room) =>
      room.roomTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f5f6f8' }}>
      {/* ヘッダーバー */}
      <header style={{ backgroundColor: '#06C755', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>LINE トーク履歴ビューアー</h1>
        <FileUploader onFilesSelected={handleFilesSelected} isLoading={isLoading} />
      </header>

      {errorMessage && (
        <div style={{ backgroundColor: '#ffdddd', color: '#d8000c', padding: '10px 20px', borderBottom: '1px solid #d8000c', fontSize: '14px' }}>
          {errorMessage}
        </div>
      )}

      {/* メインコンテンツエリア (2カラムレイアウト) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左側: サイドバー (トーク一覧) */}
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
                {chatRooms.length === 0 ? 'ファイルまたはフォルダを選択してください' : '該当するトークがありません'}
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
                      transition: 'background-color 0.2s',
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

        {/* 右側: メインチャット画面 */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#7494C0' }}>
          {selectedRoom ? (
            <>
              {/* トーク相手のヘッダー */}
              <div style={{ backgroundColor: '#fff', padding: '14px 20px', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                {selectedRoom.roomTitle}
              </div>

              {/* メッセージ表示エリア */}
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
                      {/* 送信者名（相手の場合のみ表示） */}
                      {!msg.isMyMessage && (
                        <span style={{ fontSize: '12px', color: '#fff', marginBottom: '3px', marginLeft: '4px' }}>
                          {msg.senderName}
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: msg.isMyMessage ? 'row-reverse' : 'row' }}>
                        {/* メッセージフキダシ */}
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

                        {/* 送信時刻 */}
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
