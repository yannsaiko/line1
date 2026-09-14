import { User } from '../types/chat';

/**
 * 数値と文字列の差異を無視してIDを比較する
 */
export const isSameUserId = (id1: any, id2: any): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return String(id1) === String(id2);
};

/**
 * トーク相手の情報（自分以外のユーザー）を取得する
 */
export const getPartnerUser = (room: any, currentUserId: any): User | null => {
  if (!room) return null;

  // 1. members または users 配列から探す
  const members: any[] = room.members || room.users || [];
  if (members.length > 0) {
    const partner = members.find((m) => !isSameUserId(m.id || m.user_id || m.userId, currentUserId));
    if (partner) {
      return {
        id: String(partner.id || partner.user_id || partner.userId),
        name: partner.name || partner.username || partner.display_name || partner.nickname || 'トーク相手',
        avatarUrl: partner.avatarUrl || partner.avatar_url,
      };
    }
  }

  // 2. room.partner や room.opponent など直接格納されている場合
  const directPartner = room.partner || room.opponent || room.otherUser;
  if (directPartner) {
    return {
      id: String(directPartner.id || directPartner.user_id),
      name: directPartner.name || directPartner.username || directPartner.display_name || 'トーク相手',
      avatarUrl: directPartner.avatarUrl || directPartner.avatar_url,
    };
  }

  return null;
};

/**
 * トーク部屋名（ヘッダーに表示する名前）を取得する
 */
export const getRoomDisplayTitle = (room: any, currentUserId: any): string => {
  if (!room) return '読み込み中...';

  // グループの場合
  if (room.type === 'group' || room.isGroup) {
    return room.title || room.name || room.groupName || 'グループトーク';
  }

  // 1対1の場合、相手の名前を取得
  const partner = getPartnerUser(room, currentUserId);
  if (partner && partner.name) {
    return partner.name;
  }

  // ルーム自体に直接名前がある場合
  if (room.title || room.name) {
    return room.title || room.name;
  }

  return 'トーク相手';
};
