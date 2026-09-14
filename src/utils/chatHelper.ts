import { LineUser, LineChat } from '../types/chat';

export const isSameUserId = (id1: any, id2: any): boolean => {
  if (!id1 || !id2) return false;
  return String(id1).trim() === String(id2).trim();
};

/**
 * 自分以外のユーザー（ZMID比較）から表示名を取得
 */
export const getPartnerUser = (room: LineChat, currentUserId: string): LineUser | null => {
  if (!room || !room.members || !Array.isArray(room.members)) return null;

  const partner = room.members.find((member) => !isSameUserId(member.ZMID, currentUserId));
  return partner || null;
};

/**
 * 優先順位：手動変更名(ZCUSTOMNAME) > 本名(ZNAME) > ルーム名
 */
export const getRoomDisplayTitle = (room: LineChat, currentUserId: string): string => {
  if (!room) return '読み込み中...';

  // ルーム自体に名前（グループ名等）がある場合
  if (room.ZNAME) {
    return room.ZNAME;
  }

  // 1対1トークの場合、相手の情報から取得
  const partner = getPartnerUser(room, currentUserId);
  if (partner) {
    return partner.ZCUSTOMNAME || partner.ZNAME || 'トーク相手';
  }

  return 'トーク相手';
};
