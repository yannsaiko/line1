import { LineUser, LineChat } from '../types/chat';

export const isSameUserId = (id1: any, id2: any): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return String(id1).trim() === String(id2).trim();
};

export const getPartnerUser = (room: LineChat, currentUserId: string): LineUser | null => {
  if (!room) return null;
  const members = room.members || room.users || room.participants || [];

  if (Array.isArray(members) && members.length > 0) {
    const partner = members.find((m: any) => {
      const id = m?.ZMID || m?.zmid || m?.id;
      return !isSameUserId(id, currentUserId);
    });
    if (partner) return partner;
  }
  return null;
};

export const getRoomDisplayTitle = (room: LineChat, currentUserId: string): string => {
  if (!room) return '読み込み中...';
  const partner = getPartnerUser(room, currentUserId);

  if (partner) {
    return partner.ZCUSTOMNAME || partner.zcustomname || partner.ZNAME || partner.zname || partner.name || 'トーク相手';
  }
  return room.ZNAME || room.zname || room.title || 'トーク相手';
};
