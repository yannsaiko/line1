import { User } from '../types/chat';

export const isSameUserId = (id1: any, id2: any): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  return String(id1) === String(id2);
};

export const getPartnerUser = (room: any, currentUserId: any): User | null => {
  if (!room) return null;

  // 可能なメンバー配列のプロパティ名をすべて探索
  const members: any[] = 
    room.members || 
    room.participants || 
    room.users || 
    room.memberList || 
    room.members_list || 
    [];

  if (Array.isArray(members) && members.length > 0) {
    // 自分のID以外のメンバーを探す
    const partner = members.find((m: any) => {
      const memberId = typeof m === 'object' ? (m.id || m.userId || m.user_id || m.uid) : m;
      return !isSameUserId(memberId, currentUserId);
    });

    if (partner) {
      if (typeof partner === 'string' || typeof partner === 'number') {
        return { id: String(partner), name: `ユーザー_${partner}` };
      }
      return {
        id: String(partner.id || partner.userId || partner.user_id || partner.uid),
        name: partner.name || partner.username || partner.displayName || partner.display_name || partner.nickname || 'トーク相手',
        avatarUrl: partner.avatarUrl || partner.avatar_url || partner.photoURL,
      };
    }
  }

  // 配列ではなく、room 直下に相手の情報が入っているパターン
  const directPartner = room.partner || room.opponent || room.targetUser || room.recipient || room.otherUser;
  if (directPartner) {
    return {
      id: String(directPartner.id || directPartner.userId || directPartner.user_id || directPartner.uid),
      name: directPartner.name || directPartner.username || directPartner.displayName || directPartner.display_name || 'トーク相手',
      avatarUrl: directPartner.avatarUrl || directPartner.avatar_url,
    };
  }

  return null;
};

export const getRoomDisplayTitle = (room: any, currentUserId: any): string => {
  if (!room) return '読み込み中...';

  if (room.type === 'group' || room.isGroup || room.is_group) {
    return room.title || room.name || room.groupName || 'グループトーク';
  }

  const partner = getPartnerUser(room, currentUserId);
  if (partner && partner.name && partner.name !== 'トーク相手') {
    return partner.name;
  }

  return room.title || room.name || room.roomName || 'トーク相手';
};
