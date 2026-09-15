import React, { useState, useMemo } from 'react';
import SqliteParser from './services/sqliteParser';
import ChatRoom from './components/ChatRoom';
import FileUploader from './components/FileUploader';
import { NormalizedChatRoom } from './types/lineDatabase';

export const App = () => {
  const [uploadedRoomData, setUploadedRoomData] = useState<NormalizedChatRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = "u100000000000000000000000000001";

  const defaultParsedRoom = useMemo(() => {
    const rawZChat = { ZMID: "u2000000000000000000000000000002", ZNAME: "" };
    const rawZUsers = [
      { ZMID: "u100000000000000000000000000001", ZNAME: "自分" },
      { ZMID: "u200000000000000000000000000002", ZNAME: "佐藤 健", ZCUSTOMNAME: "佐藤健（仕事用）" }
    ];
    const rawZMessages = [
      {
        Z_PK: 101,
        ZSENDER: "u200000000000000000000000000002",
        ZTEXT: "お疲れ様です。明日のミーティングの件です。",
        ZCREATEDTIME: 748161000
      },
      {
        Z_PK: 102,
        ZSENDER: "u100000000000000000000000000001",
        ZTEXT: "了解いたしました！14時に参加いたします。",
        ZCREATEDTIME: 1726383060000
      }
    ];
    return SqliteParser.buildChatRoom(rawZChat, rawZUsers, rawZMessages, currentUserId);
  }, [currentUserId]);

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const parsed = SqliteParser.buildChatRoom(
          data.rawChat || {},
          data.rawUsers || [],
          data.rawMessages || [],
          currentUserId
        );
        setUploadedRoomData(parsed);
      } else {
        const buffer = await file.arrayBuffer();
        const parsed = await SqliteParser.parseSqliteFile(buffer, currentUserId);
        setUploadedRoomData(parsed);
      }
    } catch (err: any) {
      console.error(err);
      setError(`DB解析エラー: ${err.message || 'SQLiteファイルの読み込みに失敗しました。'}`);
    } finally {
      setLoading(false);
    }
  };

  const currentRoomData = uploadedRoomData || defaultParsedRoom;

  return (
    <div style={{ padding: '20px' }}>
      <FileUploader onFileSelect={handleFileSelect} isLoading={loading} />

      {error && (
        <div style={{ color: '#d9534f', textAlign: 'center', margin: '16px 0', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {uploadedRoomData && (
        <div className="no-print" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <button
            onClick={() => setUploadedRoomData(null)}
            style={{
              padding: '8px 16px',
              background: '#666666',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 デモデータ表示に戻す
          </button>
        </div>
      )}

      <ChatRoom roomData={currentRoomData} />
    </div>
  );
};

export default App;
