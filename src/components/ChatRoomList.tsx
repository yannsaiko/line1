import React, { useState } from 'react';
import { NormalizedChatRoom } from '../types/lineDatabase';

export interface ChatRoomListProps {
  rooms: NormalizedChatRoom[];
  selectedChatId: string | number | null;
  onSelectRoom: (room: NormalizedChatRoom) => void;
}

export const ChatRoomList: React.FC<ChatRoomListProps> = ({
  rooms,
  selectedChatId,
  onSelectRoom,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRooms = rooms.filter((room) => {
    const term = searchTerm.toLowerCase();
    const titleMatch = room.roomTitle.toLowerCase().includes(term);
    const msgMatch = room.lastMessageText.toLowerCase().includes(term);
    return titleMatch || msgMatch;
  });

  return (
    <div
      style={{
        width: '300px',
        minWidth: '280px',
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
      }}
    >
      <div style={{ padding: '12px', borderBottom: '1px solid #eeeeee' }}>
        <input
          type="text"
          placeholder="🔍 トーク相手を検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '20px',
            border: '1px solid #cccccc',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredRooms.length === 0 ? (
          <div style={{ padding: '20px', color: '#888', fontSize: '13px', textAlign: 'center' }}>
            一致するトーク相手がいません
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isSelected = room.chatId === selectedChatId;
            return (
              <div
                key={room.chatId}
                onClick={() => onSelectRoom(room)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#e8f5e9' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                    {room.roomTitle}
                  </span>
                  <span style={{ fontSize: '11px', color: '#999' }}>
                    {room.lastMessageTime}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {room.lastMessageText || '（メッセージなし）'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatRoomList;
