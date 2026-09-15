import { LineDataParser } from './lineDataParser';
import { RawZUser, RawZMessage, RawZChat, NormalizedChatRoom } from '../types/lineDatabase';

export class SqliteParser {
  public static buildChatRoom(
    rawChat: RawZChat,
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom {
    const rooms = LineDataParser.parseAllChatRooms([rawChat], rawUsers, rawMessages, currentUserId);
    if (rooms.length > 0) {
      return rooms[0];
    }

    const chatId = rawChat.Z_PK ?? rawChat.z_pk ?? rawChat.ZMID ?? rawChat.zmid ?? '0';
    const chatMid = String(rawChat.ZMID || rawChat.zmid || '').trim();
    const roomTitle = rawChat.ZNAME || rawChat.zname || 'トーク相手';

    return {
      chatId,
      chatMid,
      roomTitle,
      partner: null,
      messages: [],
      lastMessageText: '',
      lastMessageTime: '',
      lastTimestamp: 0,
    };
  }

  public static parseChatRoom(
    rawChat: RawZChat,
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom {
    return this.buildChatRoom(rawChat, rawUsers, rawMessages, currentUserId);
  }

  public static parseAllChatRooms(
    rawChats: RawZChat[],
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom[] {
    return LineDataParser.parseAllChatRooms(rawChats, rawUsers, rawMessages, currentUserId);
  }
}

export default SqliteParser;
