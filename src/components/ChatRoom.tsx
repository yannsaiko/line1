import React from 'react';
import { NormalizedChatRoom } from '../types/lineDatabase';

export interface ChatRoomProps {
  roomData: NormalizedChatRoom;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomData }) => {
  if (!roomData || !roomData.messages) {
    return (
      <div style={{ padding: '20px', color: '#d9534f', fontWeight: 'bold' }}>
        【エラー】解析データが存在しません。
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: '0 12px' }}>
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
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '12px' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 18px',
            background: '#06C755',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap'
          }}
        >
          🖨️ このトークをカラー印刷する
        </button>
      </div>

      <div style={{ border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', background: '#7494c0', width: '100%' }}>
        <header style={{ background: '#273238', color: '#ffffff', padding: '14px 20px', borderBottom: '1px solid #1e2529' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{roomData.roomTitle}</h2>
        </header>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '400px' }}>
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
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    background: msg.isMyMessage ? '#85E249' : '#FFFFFF',
                    color: '#000000',
                    padding: '10px 14px',
                    borderRadius: msg.isMyMessage ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  {msg.text}
                </div>

                <span style={{ fontSize: '11px', color: '#e8f0fe', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                  {msg.formattedTime}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
