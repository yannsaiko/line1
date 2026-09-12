import React, { useState } from 'react';
import { CURRENT_USER_ID, MOCK_USERS, MOCK_ROOM, INITIAL_MESSAGES } from './mockData';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import './App.css';

export const ChatApp: React.FC = () => {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  const partnerId = MOCK_ROOM.memberIds.find((id) => id !== CURRENT_USER_ID);
  const partnerUser = partnerId ? MOCK_USERS[partnerId] : undefined;

  const handleSendMessage = (text: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      roomId: MOCK_ROOM.id,
      senderId: CURRENT_USER_ID,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  return (
    <div className="chat-container">
      <ChatHeader partner={partnerUser} />
      <MessageList messages={messages} currentUserId={CURRENT_USER_ID} users={MOCK_USERS} />
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatApp;
