import {
  RawZUser,
  RawZMessage,
  RawZChat,
  NormalizedUser,
  NormalizedMessage,
  NormalizedChatRoom,
} from '../types/lineDatabase';
import { parseLineTimestamp } from '../utils/lineTimestampParser';

export class LineDataParser {
  public static parseChatRoom(
    rawChat: RawZChat,
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom {
    const userMap = new Map<string, NormalizedUser>();

    rawUsers.forEach((u) => {
      const mid = String(u.ZMID || u.zmid || u.id || '').trim();
      if (!mid) return;

      const customName = u.ZCUSTOMNAME || u.zcustomname;
      const name = u.ZNAME || u.zname || u.name;
      const resolvedName = customName || name || `ユーザー(${mid.slice(0, 6)})`;

      userMap.set(mid, {
        mid,
        displayName: name || '',
        customName: customName || undefined,
        resolvedName,
      });
    });

    let partnerUser: NormalizedUser | null = null;
    for (const [mid, user] of userMap.entries()) {
      if (mid !== String(currentUserId).trim()) {
        partnerUser = user;
        break;
      }
    }

    const roomTitle =
      rawChat?.ZNAME ||
      rawChat?.zname ||
      partnerUser?.resolvedName ||
      'トーク相手';

    const normalizedMessages: NormalizedMessage[] = rawMessages.map((msg, index) => {
      const senderMid = String(
        msg.ZSENDER ||
        msg.zsender ||
        msg.ZSENDERHEADER ||
        msg.zsenderheader ||
        ''
      ).trim();

      const isMyMessage = senderMid === String(currentUserId).trim();

      let senderName = 'トーク相手';
      if (isMyMessage) {
        senderName = '自分';
      } else if (userMap.has(senderMid)) {
        senderName = userMap.get(senderMid)!.resolvedName;
      } else if (partnerUser) {
        senderName = partnerUser.resolvedName;
      }

      const rawTime = msg.ZCREATEDTIME ?? msg.zcreatedtime;
      const parsedTime = parseLineTimestamp(rawTime);

      return {
        id: msg.Z_PK || msg.z_pk || index,
        text: msg.ZTEXT || msg.ztext || '',
        senderMid,
        senderName,
        timestamp: parsedTime.timestamp,
        formattedTime: parsedTime.formattedTime,
        formattedFullDate: parsedTime.formattedFullDate,
        isMyMessage,
      };
    });

    normalizedMessages.sort((a, b) => a.timestamp - b.timestamp);

    return {
      chatMid: String(rawChat?.ZMID || rawChat?.zmid || '').trim(),
      roomTitle,
      partner: partnerUser,
      messages: normalizedMessages,
    };
  }
}
