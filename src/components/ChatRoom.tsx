import React from 'react';
import { LineChat } from '../types/chat';
import { formatPrintDateTime } from '../utils/dateFormatter';
import { getPartnerUser, getRoomDisplayTitle, isSameUserId } from '../utils/chatHelper';

interface ChatRoomProps {
  room: LineChat;
  currentUserId: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  if (!room) {
    return (
      <div style={{ padding: '20px', color: '#d9534f', fontWeight: 'bold' }}>
        【データ無効】トークデータが正しく読み込まれていません。
      </div>
    );
  }

  const partnerUser = getPartnerUser(room, currentUserId);
  const partnerName = getRoomDisplayTitle(room, currentUserId);
  const messages = room.messages || room.messageList || [];

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

      {/* 右寄り切れを防いだコントロールバー */}
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

      {/* チャット画面表示部 */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', background: '#7494c0', width: '100%' }}>
        <header style={{ background: '#273238', color: '#ffffff', padding: '14px 20px', borderBottom: '1px solid #1e2529' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{partnerName}</h2>
        </header>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '400px' }}>
          {messages.map((msg: any, index: number) => {
            const senderId = msg?.ZSENDER || msg?.zsender || msg?.ZSENDERHEADER || msg?.zsenderheader || msg?.senderId;
            const isMyMessage = isSameUserId(senderId, currentUserId);

            const rawTime = msg?.ZCREATEDTIME ?? msg?.zcreatedtime ?? msg?.createdAt ?? msg?.timestamp;
            const formattedTime = formatPrintDateTime(rawTime);
            const text = msg?.ZTEXT || msg?.ztext || msg?.text || '';

            return (
              <div
                key={msg?.Z_PK || msg?.z_pk || msg?.id || index}
                className="message-row"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                }}
              >
                {!isMyMessage && (
                  <span style={{ fontSize: '12px', color: '#ffffff', marginBottom: '4px', fontWeight: 'bold' }}>
                    {partnerName}
                  </span>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '6px',
                    flexDirection: isMyMessage ? 'row-reverse' : 'row',
                    maxWidth: '85%',
                  }}
                >
                  <div
                    style={{
                      background: isMyMessage ? '#85E249' : '#FFFFFF',
                      color: '#000000',
                      padding: '10px 14px',
                      borderRadius: isMyMessage ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      fontSize: '14px',
                      lineHeight: '1.4',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  >
                    {text}
                  </div>

                  {formattedTime && (
                    <span style={{ fontSize: '11px', color: '#e8f0fe', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                      {formattedTime}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
