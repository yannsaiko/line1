import { LineDataParser } from './lineDataParser';
import { RawZUser, RawZMessage, RawZChat, NormalizedChatRoom } from '../types/lineDatabase';

export class SqliteParser {
  /**
   * 単一のチャットルームを構築（型定義に完全準拠）
   */
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

  /**
   * 互換用メソッド名（parseChatRoom）
   */
  public static parseChatRoom(
    rawChat: RawZChat,
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom {
    return this.buildChatRoom(rawChat, rawUsers, rawMessages, currentUserId);
  }

  /**
   * 全チャットルームのパース
   */
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
