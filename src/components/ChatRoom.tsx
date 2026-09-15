import React from 'react';
import { NormalizedChatRoom } from '../types/lineDatabase';

export interface ChatRoomProps {
  roomData: NormalizedChatRoom | null;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomData }) => {
  if (!roomData) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#f9f9f9' }}>
        トーク相手を選択してください
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#7494c0', position: 'relative' }}>
      <style>{`
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; margin: 0; padding: 0; }
          .message-row { page-break-inside: avoid; }
          .print-container { height: auto !important; overflow: visible !important; }
        }
      `}</style>

      {/* ヘッダー / 印刷ボタン */}
      <header
        className="no-print"
        style={{
          background: '#273238',
          color: '#ffffff',
          padding: '12px 20px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1e2529',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{roomData.roomTitle}</h2>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 16px',
            background: '#06C755',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }}
        >
          🖨️ このトークをカラー印刷
        </button>
      </header>

      {/* メッセージ表示エリア */}
      <div
        className="print-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {roomData.messages.map((msg) => (
          <div
            key={msg.id}
            className="message-row"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.isMyMessage ? 'flex-end' : 'flex-start',
            }}
          >
            {/* 相手の名前 */}
            {!msg.isMyMessage && (
              <span style={{ fontSize: '12px', color: '#ffffff', marginBottom: '4px', fontWeight: 'bold' }}>
                {msg.senderName}
              </span>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '6px',
                flexDirection: msg.isMyMessage ? 'row-reverse' : 'row',
                maxWidth: '75%',
              }}
            >
              {/* メッセージ本文 */}
              <div
                style={{
                  background: msg.isMyMessage ? '#85E249' : '#FFFFFF',
                  color: '#000000',
                  padding: '10px 14px',
                  borderRadius: msg.isMyMessage ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  fontSize: '14px',
                  lineHeight: '1.45',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {msg.text}
              </div>

              {/* 送信日時（時刻） */}
              <span style={{ fontSize: '11px', color: '#e8f0fe', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                {msg.formattedTime}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatRoom;
