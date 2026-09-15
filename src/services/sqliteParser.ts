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
    return rooms[0] || {
      chatId: '0',
      chatMid: '',
      roomTitle: 'トーク相手',
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
