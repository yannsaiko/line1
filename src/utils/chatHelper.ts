/**
 * オブジェクトから大文字・小文字を無視して値を取得するヘルパー
 */
const getValueIgnoreCase = (obj: any, keys: string[]): any => {
  if (!obj || typeof obj !== 'object') return null;
  
  const lowerObjKeys = Object.keys(obj).reduce((acc: any, key) => {
    acc[key.toLowerCase()] = obj[key];
    return acc;
  }, {});

  for (const key of keys) {
    const val = lowerObjKeys[key.toLowerCase()];
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }
  return null;
};

export const isSameUserId = (id1: any, id2: any): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return String(id1).trim() === String(id2).trim();
};

/**
 * トーク相手（自分以外のユーザー）のオブジェクトを取得
 */
export const getPartnerUser = (room: any, currentUserId: string): any => {
  if (!room) return null;

  // メンバー配列を取得
  const members: any[] = getValueIgnoreCase(room, ['members', 'users', 'participants']) || [];

  if (Array.isArray(members) && members.length > 0) {
    const partner = members.find((m: any) => {
      const memberId = typeof m === 'object' 
        ? getValueIgnoreCase(m, ['ZMID', 'zmid', 'id', 'userId', 'user_id', 'uid'])
        : m;
      return !isSameUserId(memberId, currentUserId);
    });

    if (partner) return partner;
  }

  // room 直下に相手情報が入っている場合
  return getValueIgnoreCase(room, ['partner', 'opponent', 'targetUser', 'otherUser']);
};

/**
 * 表示用トーク部屋名を取得
 */
export const getRoomDisplayTitle = (room: any, currentUserId: string): string => {
  if (!room) return '読み込み中...';

  // ルーム名・グループ名のチェック
  const roomTitle = getValueIgnoreCase(room, ['ZNAME', 'zname', 'title', 'name', 'roomName']);
  if (roomTitle && !getValueIgnoreCase(room, ['isSingleTalk'])) {
    return roomTitle;
  }

  // 1対1トーク相手の名前を取得
  const partner = getPartnerUser(room, currentUserId);
  if (partner) {
    const partnerName = getValueIgnoreCase(partner, ['ZCUSTOMNAME', 'zcustomname', 'custom_name', 'ZNAME', 'zname', 'name', 'displayName', 'username']);
    if (partnerName) return partnerName;
  }

  return roomTitle || 'トーク相手';
};
