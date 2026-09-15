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
}

export default SqliteParser;
