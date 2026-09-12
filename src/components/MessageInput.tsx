import React, { useState } from 'react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="メッセージを入力..."
      />
      <button type="submit">送信</button>
    </form>
  );
};
