import React, { useEffect } from 'react';
import { formatMessageTime } from '../utils/dateFormatter';
import { getPartnerUser, getRoomDisplayTitle, isSameUserId } from '../utils/chatHelper';

interface ChatRoomProps {
  room: any;
  currentUserId: any;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  // 開発確認用ログ（ブラウザの F12 コンソールで実際のデータを確認できます）
  useEffect(() => {
    console.log('【ChatRoom データ確認】room:', room);
    console.log('【ChatRoom データ確認】currentUserId:', currentUserId);
  }, [room, currentUserId]);

  const roomTitle = getRoomDisplayTitle(room, currentUserId);
  const partnerUser = getPartnerUser(room, currentUserId);

  const messages: any[] = room?.messages || room?.messageList || [];

  return (
    <div className="chat-container">
      {/* 部屋名（相手の名前） */}
      <header className="chat-header">
        <h2>{roomTitle}</h2>
      </header>

      {/* メッセージ表示 */}
      <div className="message-list">
        {messages.map((message: any, index: number) => {
          // 送信者IDの取得（プロパティ名表記揺れに対応）
          const senderId = message.senderId || message.sender_id || message.userId || message.user_id;
          const isMyMessage = isSameUserId(senderId, currentUserId);

          // 送信時刻の取得（プロパティ名表記揺れに対応）
          const rawTime = message.createdAt || message.created_at || message.timestamp || message.time || message.date;
          const formattedTime = formatMessageTime(rawTime);

          return (
            <div
              key={message.id || message.message_id || index}
              className={`message-item ${isMyMessage ? 'my-message' : 'partner-message'}`}
            >
              {!isMyMessage && (
                <span className="sender-name">
                  {partnerUser?.name || message.senderName || 'トーク相手'}
                </span>
              )}
              <div className="message-bubble">{message.text || message.content || message.body}</div>
              <span className="message-time">{formattedTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
