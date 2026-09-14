import React from 'react';
import { Room } from '../types/chat';
import { formatMessageTime } from '../utils/dateFormatter';
import { getPartnerUser, getRoomDisplayTitle } from '../utils/chatHelper';

interface ChatRoomProps {
  room: Room;
  currentUserId: string; // ログイン中の自分のユーザーID
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  // 1. トーク部屋名を取得（相手の名前）
  const roomTitle = getRoomDisplayTitle(room, currentUserId);

  // 2. 相手の情報（アイコン画像等で使用）
  const partnerUser = getPartnerUser(room, currentUserId);

  return (
    <div className="chat-container">
      {/* ヘッダー：トーク部屋（相手の名前を表示） */}
      <header className="chat-header">
        <h2>{roomTitle}</h2>
      </header>

      {/* メッセージ一覧 */}
      <div className="message-list">
        {room.messages.map((message) => {
          const isMyMessage = message.senderId === currentUserId;
          // 3. 送信時刻を正確にフォーマット
          const formattedTime = formatMessageTime(message.createdAt);

          return (
            <div
              key={message.id}
              className={`message-item ${isMyMessage ? 'my-message' : 'partner-message'}`}
            >
              {!isMyMessage && (
                <span className="sender-name">
                  {partnerUser?.name || '不明なユーザー'}
                </span>
              )}
              <div className="message-bubble">{message.text}</div>
              <span className="message-time">{formattedTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
