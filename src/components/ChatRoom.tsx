import React from 'react';
import { LineChat, LineMessage } from '../types/chat';
import { formatMessageTime } from '../utils/dateFormatter';
import { getPartnerUser, getRoomDisplayTitle, isSameUserId } from '../utils/chatHelper';

interface ChatRoomProps {
  room: LineChat;
  currentUserId: string; // 自分の ZMID (例: "u12345678...")
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  const roomTitle = getRoomDisplayTitle(room, currentUserId);
  const partnerUser = getPartnerUser(room, currentUserId);

  // 表示名：設定変更名(ZCUSTOMNAME)があれば最優先
  const partnerDisplayName = partnerUser
    ? partnerUser.ZCUSTOMNAME || partnerUser.ZNAME || 'トーク相手'
    : 'トーク相手';

  const messages = room?.messages || [];

  return (
    <div className="chat-container">
      {/* 部屋名（相手の名前） */}
      <header className="chat-header">
        <h2>{roomTitle}</h2>
      </header>

      {/* メッセージ一覧 */}
      <div className="message-list">
        {messages.map((message: LineMessage, index: number) => {
          // 送信者ID判定（ZSENDER または ZSENDERHEADER）
          const senderId = message.ZSENDER || message.ZSENDERHEADER;
          const isMyMessage = isSameUserId(senderId, currentUserId);

          // ZCREATEDTIME (13桁ミリ秒) から時刻フォーマット
          const formattedTime = formatMessageTime(message.ZCREATEDTIME);

          return (
            <div
              key={message.Z_PK || index}
              className={`message-item ${isMyMessage ? 'my-message' : 'partner-message'}`}
            >
              {!isMyMessage && (
                <span className="sender-name">{partnerDisplayName}</span>
              )}
              <div className="message-bubble">{message.ZTEXT || ''}</div>
              <span className="message-time">{formattedTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
