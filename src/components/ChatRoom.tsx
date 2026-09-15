import React from 'react';

interface ChatRoomProps {
  room: any;
  currentUserId: any;
}

const formatPrintDateTime = (rawTime: any): string => {
  if (rawTime === undefined || rawTime === null || rawTime === '' || rawTime === 0) return '';

  const num = typeof rawTime === 'string' ? Number(rawTime) : rawTime;
  let date: Date;

  if (typeof num === 'number' && !isNaN(num)) {
    if (num > 1000000000000) {
      date = new Date(num);
    } else if (num > 100000000 && num < 1000000000) {
      date = new Date(num * 1000 + 978307200000);
    } else if (num >= 1000000000 && num <= 10000000000) {
      date = new Date(num * 1000);
    } else {
      date = new Date(num);
    }
  } else {
    date = new Date(rawTime);
  }

  if (isNaN(date.getTime()) || date.getFullYear() === 1970) return '';

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
};

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  if (!room) {
    return (
      <div style={{ padding: '20px', color: '#d9534f', fontWeight: 'bold' }}>
        【エラー】room データが読み込まれていません。
      </div>
    );
  }

  const members = room.members || room.users || room.participants || [];
  const partner = Array.isArray(members)
    ? members.find((m: any) => String(m?.ZMID || m?.zmid || m?.id || m?.userId) !== String(currentUserId))
    : null;

  const partnerName =
    partner?.ZCUSTOMNAME ||
    partner?.zcustomname ||
    partner?.ZNAME ||
    partner?.zname ||
    partner?.name ||
    room.ZNAME ||
    room.zname ||
    room.title ||
    'トーク相手';

  const messages = room.messages || room.messageList || room.zmessages || [];

  return (
    <div className="chat-printable-wrapper" style={{ fontFamily: 'sans-serif', maxWidth: '800px', width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: '0 12px' }}>
      <style>{`
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; margin: 0; padding: 0; }
          .chat-printable-wrapper { width: 100% !important; max-width: none !important; padding: 0 !important; }
          .message-row { page-break-inside: avoid; }
        }
      `}</style>

      {/* コントロールバー：はみ出し防止用にFlexboxとマージンを調整 */}
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
            maxWidth: '100%',
            whiteSpace: 'nowrap'
          }}
        >
          🖨️ このトークをカラー印刷する
        </button>
      </div>

      <div style={{ border: '1px solid #e0e0e0', borderRadius: '10px', overflow: 'hidden', background: '#7494c0', width: '100%' }}>
        <header style={{ background: '#273238', color: '#ffffff', padding: '14px 20px', borderBottom: '1px solid #1e2529' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{partnerName}</h2>
        </header>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '400px' }}>
          {messages.map((msg: any, index: number) => {
            const senderId = msg?.ZSENDER || msg?.zsender || msg?.senderId || msg?.userId;
            const isMyMessage = String(senderId) === String(currentUserId);
            const rawTime = msg?.ZCREATEDTIME ?? msg?.zcreatedtime ?? msg?.createdAt ?? msg?.created_at ?? msg?.timestamp;
            const formattedTime = formatPrintDateTime(rawTime);
            const text = msg?.ZTEXT || msg?.ztext || msg?.text || msg?.content || '';

            return (
              <div
                key={msg?.Z_PK || msg?.id || index}
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
