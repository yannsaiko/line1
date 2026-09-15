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

    // ユーザー情報のマッピング
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

    // 全メッセージの整形（自分のメッセージ・相手のメッセージ双方を含める）
    const normalizedMessages: NormalizedMessage[] = rawMessages.map((msg, index) => {
      const senderMid = String(
        msg.ZSENDER || msg.zsender || msg.ZSENDERHEADER || msg.zsenderheader || ''
      ).trim();

      const isMyMessage =
        senderMid === String(currentUserId).trim() ||
        senderMid === '' ||
        senderMid === '0';

      let senderName = isMyMessage ? '自分' : 'トーク相手';
      if (!isMyMessage && userMap.has(senderMid)) {
        senderName = userMap.get(senderMid)!.resolvedName;
      }

      const rawTime = msg.ZCREATEDTIME ?? msg.zcreatedtime ?? msg.ZDATE ?? msg.zdate;
      const parsedTime = parseLineTimestamp(rawTime);

      return {
        id: msg.Z_PK || msg.z_pk || index,
        text: msg.ZTEXT || msg.ztext || msg.ZBODY || msg.zbody || '',
        senderMid,
        senderName,
        timestamp: parsedTime.timestamp,
        formattedTime: parsedTime.formattedTime,
        formattedFullDate: parsedTime.formattedFullDate,
        isMyMessage,
      };
    });

    normalizedMessages.sort((a, b) => a.timestamp - b.timestamp);

    // チャットルーム単位にまとめる
    const chatRooms: NormalizedChatRoom[] = (rawChats.length > 0 ? rawChats : [{ Z_PK: 1 }]).map(
      (chat) => {
        const chatId = chat.Z_PK ?? chat.z_pk ?? chat.ZMID ?? chat.zmid ?? '1';
        const chatMid = String(chat.ZMID || chat.zmid || '').trim();

        // 相手ユーザーの特定
        let partnerUser: NormalizedUser | null = null;
        for (const msg of normalizedMessages) {
          if (!msg.isMyMessage && msg.senderMid && userMap.has(msg.senderMid)) {
            partnerUser = userMap.get(msg.senderMid)!;
            break;
          }
        }

        const roomTitle =
          chat.ZNAME ||
          chat.zname ||
          partnerUser?.resolvedName ||
          (userMap.size > 0 ? Array.from(userMap.values())[0].resolvedName : 'トーク相手');

        const lastMsg = normalizedMessages[normalizedMessages.length - 1];

        return {
          chatId,
          chatMid,
          roomTitle,
          partner: partnerUser,
          messages: normalizedMessages,
          lastMessageText: lastMsg ? lastMsg.text : '',
          lastMessageTime: lastMsg ? lastMsg.formattedTime : '',
          lastTimestamp: lastMsg ? lastMsg.timestamp : 0,
        };
      }
    );

    return chatRooms;
  }
}
