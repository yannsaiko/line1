import { Room, User } from '../types/chat';

/**
 * 参加メンバーの中から「トーク相手（自分以外のユーザー）」を取得する
 */
export const getPartnerUser = (room: Room, currentUserId: string): User | null => {
  if (!room || !room.members) return null;
  
  // 自分以外のIDを持つユーザーを探す
  const partner = room.members.find((member) => member.id !== currentUserId);
  return partner || null;
};

/**
 * トーク部屋名を取得する
 * 1対1のトーク：相手の名前
 * グループ：設定されたグループ名、またはデフォルト名
 */
export const getRoomDisplayTitle = (room: Room, currentUserId: string): string => {
  if (room.type === 'group') {
    return room.title || 'グループトーク';
  }

  // 1対1トークの場合
  const partner = getPartnerUser(room, currentUserId);
  return partner ? partner.name : '不明なユーザー';
};
