import React from 'react';
import { User } from '../types';

interface ChatHeaderProps {
  partner: User | undefined;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ partner }) => {
  return (
    <div className="chat-header">
      <div className="header-info">
        <span className="status-dot"></span>
        <h2 className="header-title">{partner ? partner.name : 'トーク相手'}</h2>
      </div>
    </div>
  );
};
