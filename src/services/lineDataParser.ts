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
      const mid = String(u.ZMID || u.zmid || u.Z_PK || u.z_pk || u.id || '').trim();
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

    // 全メッセージの正規化
    const allNormalizedMessages: NormalizedMessage[] = rawMessages.map((msg, index) => {
      const senderMid = String(
        msg.ZSENDER || msg.zsender || msg.ZSENDERHEADER || msg.zsenderheader || msg.sender || ''
      ).trim();

      const isMyMessage =
        senderMid === String(currentUserId).trim() ||
        senderMid === '' ||
        senderMid === '0' ||
        String(msg.ZISFROMME || msg.zisfromme || '').toLowerCase() === 'true' ||
        Number(msg.ZISFROMME || msg.zisfromme || 0) === 1;

      let senderName = isMyMessage ? '自分' : 'トーク相手';
      if (!isMyMessage && userMap.has(senderMid)) {
        senderName = userMap.get(senderMid)!.resolvedName;
      }

      const rawTime = msg.ZCREATEDTIME ?? msg.zcreatedtime ?? msg.ZDATE ?? msg.zdate ?? msg.timestamp;
      const parsedTime = parseLineTimestamp(rawTime);

      const chatRef = String(
        msg.ZCHAT || msg.zchat || msg.ZCHATROOM || msg.zchatroom || msg.chatId || ''
      ).trim();

      return {
        id: msg.Z_PK || msg.z_pk || index,
        text: msg.ZTEXT || msg.ztext || msg.ZBODY || msg.zbody || msg.text || '',
        senderMid,
        senderName,
        timestamp: parsedTime.timestamp,
        formattedTime: parsedTime.formattedTime,
        formattedFullDate: parsedTime.formattedFullDate,
        isMyMessage,
        chatRef,
      } as NormalizedMessage & { chatRef: string };
    });

    allNormalizedMessages.sort((a, b) => a.timestamp - b.timestamp);

    if (rawChats.length === 0 && allNormalizedMessages.length > 0) {
      rawChats = [{ Z_PK: 1, ZNAME: 'LINE トーク履歴' }];
    }

    const chatRooms: NormalizedChatRoom[] = rawChats.map((chat) => {
      const chatId = chat.Z_PK ?? chat.z_pk ?? chat.ZMID ?? chat.zmid ?? '1';
      const chatMid = String(chat.ZMID || chat.zmid || '').trim();
      const chatName = chat.ZNAME || chat.zname || chat.name;

      // チャットごとのメッセージ抽出
      let roomMessages = allNormalizedMessages.filter((m: any) => {
        if (!m.chatRef) return false;
        return m.chatRef === String(chatId) || m.chatRef === String(chatMid) || m.chatRef === String(chat.Z_PK);
      });

      // 紐付けがない場合や単一チャットの場合は全メッセージを割り当て
      if (roomMessages.length === 0) {
        roomMessages = allNormalizedMessages;
      }

      let partnerUser: NormalizedUser | null = null;
      for (const msg of roomMessages) {
        if (!msg.isMyMessage && msg.senderMid && userMap.has(msg.senderMid)) {
          partnerUser = userMap.get(msg.senderMid)!;
          break;
        }
      }

      const roomTitle =
        chatName ||
        partnerUser?.resolvedName ||
        (userMap.size > 0 ? Array.from(userMap.values())[0].resolvedName : 'トークルーム');

      const lastMsg = roomMessages[roomMessages.length - 1];

      return {
        chatId,
        chatMid,
        roomTitle,
        partner: partnerUser,
        messages: roomMessages,
        lastMessageText: lastMsg ? lastMsg.text : '',
        lastMessageTime: lastMsg ? lastMsg.formattedTime : '',
        lastTimestamp: lastMsg ? lastMsg.timestamp : 0,
      };
    });

    return chatRooms;
  }
}

export default LineDataParser;
