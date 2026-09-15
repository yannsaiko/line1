import { LineDataParser } from './lineDataParser';
import { RawZUser, RawZMessage, RawZChat, NormalizedChatRoom } from '../types/lineDatabase';

export class SqliteParser {
  public static parseAllChatRooms(
    rawChats: RawZChat[],
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom[] {
    return LineDataParser.parseAllChatRooms(rawChats, rawUsers, rawMessages, currentUserId);
  }

  public static parseChatRoom(
    rawChat: RawZChat,
    rawUsers: RawZUser[],
    rawMessages: RawZMessage[],
    currentUserId: string
  ): NormalizedChatRoom {
    const rooms = LineDataParser.parseAllChatRooms([rawChat], rawUsers, rawMessages, currentUserId);
    return rooms[0];
  }
}

export default SqliteParser;
