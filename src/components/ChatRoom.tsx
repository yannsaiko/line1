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
  const messages: any[] = room?.messages || room?.messageList || room?.message_list || [];

  return (
    <div className="chat-container">
      {/* 部屋名（相手の名前） */}
      <header className="chat-header">
        <h2>{roomTitle}</h2>
      </header>

      {/* メッセージ一覧 */}
      <div className="message-list">
        {messages.map((message: any, index: number) => {
          const senderId = message.senderId || message.sender_id || message.userId || message.user_id || message.uid;
          const isMyMessage = isSameUserId(senderId, currentUserId);

          // タイムスタンプ取得の多角化
          const rawTime = 
            message.createdAt || 
            message.created_at || 
            message.timestamp || 
            message.time || 
            message.date || 
            message.sentAt;

          const formattedTime = formatMessageTime(rawTime);

          return (
            <div
              key={message.id || message.messageId || message.message_id || index}
              className={`message-item ${isMyMessage ? 'my-message' : 'partner-message'}`}
            >
              {!isMyMessage && (
                <span className="sender-name">
                  {partnerUser?.name || message.senderName || message.sender_name || 'トーク相手'}
                </span>
              )}
              <div className="message-bubble">{message.text || message.content || message.body}</div>
              <span className="message-time">{formattedTime}</span>
            </div>
          );
        })}
      </div>

      {/* 解決しない場合用のデバッグ表示枠 */}
      <details style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', border: '1px solid #ccc' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>【データ構造の確認用デバッグエリア】</summary>
        <pre style={{ fontSize: '11px', textAlign: 'left', overflowX: 'auto' }}>
          {JSON.stringify({ currentUserId, room }, null, 2)}
        </pre>
      </details>
    </div>
  );
};
