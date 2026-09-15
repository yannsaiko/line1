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
}

export default SqliteParser;
