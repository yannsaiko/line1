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
  public static parseAllChatRooms(
    rawChats: RawZChat[],
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom[] {
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

    const messagesByChat = new Map<string | number, RawZMessage[]>();
    rawMessages.forEach((msg) => {
      const chatIdKey = msg.ZCHAT ?? msg.zchat ?? 'default';
      if (!messagesByChat.has(chatIdKey)) {
        messagesByChat.set(chatIdKey, []);
      }
      messagesByChat.get(chatIdKey)!.push(msg);
    });

    const roomList: NormalizedChatRoom[] = [];

    const processChat = (
      chatId: string | number,
      chatMid: string,
      titleFallback: string,
      rawMsgList: RawZMessage[]
    ) => {
      const normalizedMessages: NormalizedMessage[] = rawMsgList.map((msg, index) => {
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

      let partnerUser: NormalizedUser | null = null;
      for (const msg of normalizedMessages) {
        if (!msg.isMyMessage && userMap.has(msg.senderMid)) {
          partnerUser = userMap.get(msg.senderMid)!;
          break;
        }
      }

      const roomTitle = titleFallback || partnerUser?.resolvedName || 'トーク相手';
      const lastMsg = normalizedMessages[normalizedMessages.length - 1];

      roomList.push({
        chatId,
        chatMid,
        roomTitle,
        partner: partnerUser,
        messages: normalizedMessages,
        lastMessageText: lastMsg ? lastMsg.text : '',
        lastMessageTime: lastMsg ? lastMsg.formattedTime : '',
        lastTimestamp: lastMsg ? lastMsg.timestamp : 0,
      });
    };

    if (rawChats.length > 0) {
      rawChats.forEach((chat) => {
        const chatId = chat.Z_PK ?? chat.z_pk ?? chat.ZMID ?? chat.zmid ?? '0';
        const chatMid = String(chat.ZMID || chat.zmid || '').trim();
        const chatTitle = chat.ZNAME || chat.zname || '';
        const rawMsgList = messagesByChat.get(chatId) || [];

        processChat(chatId, chatMid, chatTitle, rawMsgList);
      });
    } else {
      messagesByChat.forEach((rawMsgList, chatId) => {
        processChat(chatId, '', '', rawMsgList);
      });
    }

    roomList.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    return roomList;
  }
}

export default LineDataParser;
