import React, { useState } from 'react';
import { LineDataParser } from './services/lineDataParser';
import { FileUploader } from './components/FileUploader';
import { NormalizedChatRoom } from './types/lineDatabase';

export const App: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<NormalizedChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<NormalizedChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesSelect = async (files: FileList | File[]) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const rawChats: any[] = [];
      const rawUsers: any[] = [];
      const rawMessages: any[] = [];
      const currentUserId = '0';

      const parsedRooms = LineDataParser.parseAllChatRooms(
        rawChats,
        rawUsers,
        rawMessages,
        currentUserId
      );

      setChatRooms(parsedRooms);
      if (parsedRooms.length > 0) {
        setSelectedRoom(parsedRooms[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'ファイルの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>LINE トーク履歴ビューアー</h1>

      <FileUploader onFilesSelected={handleFilesSelect} isLoading={isLoading} />

      {errorMessage && (
        <div style={{ color: 'red', margin: '10px 0' }}>{errorMessage}</div>
      )}

      {chatRooms.length > 0 && (
        <div>
          <h2>トークルーム一覧 ({chatRooms.length})</h2>
          <ul>
            {chatRooms.map((room, idx) => (
              <li
                key={room.chatId || idx}
                onClick={() => setSelectedRoom(room)}
                style={{
                  cursor: 'pointer',
                  fontWeight: selectedRoom?.chatId === room.chatId ? 'bold' : 'normal',
                }}
              >
                {room.roomTitle}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default App;
