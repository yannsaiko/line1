import React from 'react';
import { formatMessageTime } from '../utils/dateFormatter';
import { getPartnerUser, getRoomDisplayTitle, isSameUserId } from '../utils/chatHelper';

interface ChatRoomProps {
  room: any;
  currentUserId: any;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  const roomTitle = getRoomDisplayTitle(room, currentUserId);
  const partnerUser = getPartnerUser(room, currentUserId);

  // 相手の表示名を取得
  const partnerName = partnerUser 
    ? (partnerUser.ZCUSTOMNAME || partnerUser.zcustomname || partnerUser.ZNAME || partnerUser.zname || partnerUser.name || partnerUser.displayName)
    : 'トーク相手';

  const messages: any[] = room?.messages || room?.messageList || [];

  return (
    <div className="chat-container">
      {/* 部屋名 */}
      <header className="chat-header">
        <h2>{roomTitle}</h2>
      </header>

      {/* メッセージ表示 */}
      <div className="message-list">
        {messages.map((message: any, index: number) => {
          // 送信者ID（ZMID / senderId 等）
          const senderId = 
            message.ZSENDER || 
            message.zsender || 
            message.ZSENDERHEADER || 
            message.zsenderheader || 
            message.senderId || 
            message.sender_id || 
            message.userId;

          const isMyMessage = isSameUserId(senderId, currentUserId);

          // 送信時刻（ZCREATEDTIME / created_at 等）
          const rawTime = 
            message.ZCREATEDTIME ?? 
            message.zcreatedtime ?? 
            message.createdAt ?? 
            message.created_at ?? 
            message.timestamp ?? 
            message.time;

          const formattedTime = formatMessageTime(rawTime);
          const messageText = message.ZTEXT || message.ztext || message.text || message.content || '';

          return (
            <div
              key={message.Z_PK || message.z_pk || message.id || index}
              className={`message-item ${isMyMessage ? 'my-message' : 'partner-message'}`}
            >
              {!isMyMessage && (
                <span className="sender-name">{partnerName}</span>
              )}
              <div className="message-bubble">{messageText}</div>
              <span className="message-time">{formattedTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
