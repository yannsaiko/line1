import React from 'react';
import { Message, User } from '../types';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  users: Record<string, User>;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId, users }) => {
  return (
    <div className="message-list">
      {messages.map((msg) => {
        const isMe = msg.senderId === currentUserId;
        const sender = users[msg.senderId];
        const senderName = sender ? sender.name : 'メンバーなし';

        return (
          <div key={msg.id} className={`message-item ${isMe ? 'my-message' : 'partner-message'}`}>
            {!isMe && <div className="sender-name">{senderName}</div>}
            <div className="message-bubble-container">
              <div className="message-bubble">{msg.text}</div>
              <span className="timestamp">{msg.timestamp}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
