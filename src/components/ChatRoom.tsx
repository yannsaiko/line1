import React from 'react';

interface ChatRoomProps {
  room: any;
  currentUserId: any;
}

/**
 * LINE SQLite等のあらゆる日時データを正しくHH:mmに変換する万能関数
 */
const parseLineTime = (rawTime: any): string => {
  if (rawTime === undefined || rawTime === null || rawTime === '' || rawTime === 0) {
    return '時刻データなし';
  }

  const num = typeof rawTime === 'string' ? Number(rawTime) : rawTime;
  let date: Date;

  if (typeof num === 'number' && !isNaN(num)) {
    // 1. Unixミリ秒（13桁: 1700000000000〜）
    if (num > 1000000000000) {
      date = new Date(num);
    }
    // 2. iOS CoreData基準秒（2001-01-01基準: 600000000〜900000000付近）
    else if (num > 100000000 && num < 1000000000) {
      const COCOA_OFFSET = 978307200000; // 2001/01/01 00:00:00 UTC
      date = new Date(num * 1000 + COCOA_OFFSET);
    }
    // 3. Unix秒（10桁: 1700000000〜）
    else if (num >= 1000000000 && num <= 10000000000) {
      date = new Date(num * 1000);
    }
    // 4. Unixマイクロ秒・ナノ秒（16桁以上）
    else if (num > 1000000000000000) {
      date = new Date(Math.floor(num / 1000));
    } else {
      date = new Date(num);
    }
  } else {
    date = new Date(rawTime);
  }

  if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
    return `変換不能(${rawTime})`;
  }

  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentUserId }) => {
  // --- 1. 相手のデータ探索 ---
  const members = room?.members || room?.users || room?.participants || [];
  const partner = Array.isArray(members)
    ? members.find((m: any) => {
        const id = m?.ZMID || m?.zmid || m?.id || m?.userId;
        return String(id) !== String(currentUserId);
      })
    : null;

  // 名前判定（ZCUSTOMNAME > ZNAME > name など）
  const partnerName =
    partner?.ZCUSTOMNAME ||
    partner?.zcustomname ||
    partner?.ZNAME ||
    partner?.zname ||
    partner?.name ||
    partner?.displayName ||
    room?.ZNAME ||
    room?.zname ||
    room?.title ||
    'トーク相手(判定失敗)';

  // --- 2. メッセージ一覧取得 ---
  const messages = room?.messages || room?.messageList || room?.zmessages || [];

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif' }}>
      {/* ===== 診断情報パネル（ここを見れば原因が一目で分かります） ===== */}
      <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '12px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>🔍 データ構造の診断結果</h4>
        <div><strong>自分のID (currentUserId):</strong> {JSON.stringify(currentUserId) || '未設定(undefined)'}</div>
        <div><strong>判定された相手の名前:</strong> {partnerName}</div>
        <div><strong>取得できたメッセージ件数:</strong> {messages.length} 件</div>
        {messages.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <strong>1件目の生の時刻データ:</strong> {JSON.stringify(messages[0]?.ZCREATEDTIME ?? messages[0]?.created_at ?? messages[0]?.timestamp ?? '存在しません')} 
            ➔ 変換結果: {parseLineTime(messages[0]?.ZCREATEDTIME ?? messages[0]?.created_at ?? messages[0]?.timestamp)}
          </div>
        )}
      </div>

      {/* ===== トーク画面本体 ===== */}
      <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <header style={{ background: '#2b3742', color: '#fff', padding: '12px 16px', fontWeight: 'bold' }}>
          {partnerName}
        </header>

        <div style={{ padding: '16px', background: '#7494c0', minHeight: '300px' }}>
          {messages.length === 0 ? (
            <p style={{ color: '#fff' }}>メッセージデータが空です</p>
          ) : (
            messages.map((msg: any, i: number) => {
              const senderId = msg?.ZSENDER || msg?.zsender || msg?.senderId || msg?.userId;
              const isMyMessage = String(senderId) === String(currentUserId);
              const rawTime = msg?.ZCREATEDTIME ?? msg?.zcreatedtime ?? msg?.createdAt ?? msg?.created_at ?? msg?.timestamp;
              const text = msg?.ZTEXT || msg?.ztext || msg?.text || msg?.content || '';

              return (
                <div
                  key={msg?.Z_PK || msg?.id || i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                    marginBottom: '12px',
                  }}
                >
                  {!isMyMessage && (
                    <span style={{ fontSize: '11px', color: '#fff', marginBottom: '2px' }}>
                      {partnerName}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMyMessage ? 'row-reverse' : 'row' }}>
                    <div
                      style={{
                        background: isMyMessage ? '#85e249' : '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        maxWidth: '70%',
                        wordBreak: 'break-all',
                      }}
                    >
                      {text}
                    </div>
                    <span style={{ fontSize: '10px', color: '#e0e0e0' }}>
                      {parseLineTime(rawTime)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
