import React, { useState } from 'react';
import { LineDataParser } from './services/lineDataParser';
import ChatRoom from './components/ChatRoom';
import FileUploader from './components/FileUploader';
import { loadLineDataFromFile } from './utils/fileLoader';
import { NormalizedChatRoom } from './types/lineDatabase';

export const App = () => {
  const [roomData, setRoomData] = useState<NormalizedChatRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = "u100000000000000000000000000001";

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const rawData = await loadLineDataFromFile(file);
      const parsed = LineDataParser.parseChatRoom(
        rawData.rawChat,
        rawData.rawUsers,
        rawData.rawMessages,
        currentUserId
      );
      setRoomData(parsed);
    } catch (err: any) {
      console.error(err);
      setError(`解析エラー: ${err.message || 'ファイルの読み込みに失敗しました'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {!roomData && (
        <FileUploader onFileSelect={handleFileSelect} isLoading={loading} />
      )}

      {error && (
        <div style={{ color: '#d9534f', textAlign: 'center', margin: '16px 0', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {roomData && (
        <div>
          <div className="no-print" style={{ textAlign: 'center', marginBottom: '16px' }}>
            <button
              onClick={() => setRoomData(null)}
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
              🔄 別のファイルを読み込む
            </button>
          </div>
          <ChatRoom roomData={roomData} />
        </div>
      )}
    </div>
  );
};

export default App;
