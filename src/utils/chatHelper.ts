import { User, Room, LineUser, LineChat } from '../types/chat';

export const isSameUserId = (id1: any, id2: any): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return String(id1).trim() === String(id2).trim();
};

/**
 * トーク相手（自分以外のメンバー）を取得する
 */
export const getPartnerUser = (room: any, currentUserId: string): any => {
  if (!room || !room.members || !Array.isArray(room.members)) return null;

  return room.members.find((member: any) => {
    const memberId = member.ZMID || member.id || member.userId;
    return !isSameUserId(memberId, currentUserId);
  }) || null;
};

/**
 * トーク部屋名（ヘッダー名）を取得する
 */
export const getRoomDisplayTitle = (room: any, currentUserId: string): string => {
  if (!room) return '読み込み中...';

  // ルーム名・グループ名が存在する場合
  if (room.ZNAME || room.title) {
    return room.ZNAME || room.title;
  }

  // 1対1トークの場合、相手の名前を取得
  const partner = getPartnerUser(room, currentUserId);
  if (partner) {
    return partner.ZCUSTOMNAME || partner.ZNAME || partner.name || 'トーク相手';
  }

  return 'トーク相手';
};
