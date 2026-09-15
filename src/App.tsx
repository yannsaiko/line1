import React, { useState } from 'react';
import LineDataParser from './services/lineDataParser';
import ChatRoomList from './components/ChatRoomList';
import ChatRoom from './components/ChatRoom';
import FileUploader from './components/FileUploader';
import { loadLineDataFromFile } from './utils/fileLoader';
import { NormalizedChatRoom } from './types/lineDatabase';

export const App = () => {
  const [rooms, setRooms] = useState<NormalizedChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<NormalizedChatRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = "u100000000000000000000000000001";

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const rawData = await loadLineDataFromFile(file);
      const parsedRooms = LineDataParser.parseAllChatRooms(
        rawData.rawChats,
        rawData.rawUsers,
        rawData.rawMessages,
        currentUserId
      );

      setRooms(parsedRooms);
      if (parsedRooms.length > 0) {
        setSelectedRoom(parsedRooms[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError(`解析エラー: ${err.message || 'ファイルの読み込みに失敗しました'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', margin: 0, fontFamily: 'sans-serif' }}>
      {rooms.length === 0 ? (
        <div style={{ padding: '40px 20px' }}>
          <FileUploader onFileSelect={handleFileSelect} isLoading={loading} />
          {error && (
            <div style={{ color: '#d9534f', textAlign: 'center', marginTop: '16px', fontWeight: 'bold' }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0e0e0' }}>
            <div style={{ padding: '10px', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
              <button
                onClick={() => {
                  setRooms([]);
                  setSelectedRoom(null);
                }}
                style={{
                  padding: '6px 12px',
                  background: '#666',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🔄 別のDBを選択
              </button>
            </div>
            <ChatRoomList
              rooms={rooms}
              selectedChatId={selectedRoom?.chatId ?? null}
              onSelectRoom={(room) => setSelectedRoom(room)}
            />
          </div>

          <ChatRoom roomData={selectedRoom} />
        </div>
      )}
    </div>
  );
};

export default App;
