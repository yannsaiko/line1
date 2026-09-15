import initSqlJs from 'sql.js';
import {
  RawZUser,
  RawZMessage,
  RawZChat,
  NormalizedUser,
  NormalizedMessage,
  NormalizedChatRoom,
} from '../types/lineDatabase';
import { parseLineTimestamp } from '../utils/lineTimestampParser';

export class SqliteParser {
  private static sqlEngine: any = null;

  private static async getSqlEngine() {
    if (!this.sqlEngine) {
      this.sqlEngine = await initSqlJs({
        locateFile: (file) => `https://sql.js.org/dist/${file}`,
      });
    }
    return this.sqlEngine;
  }

  public static async parseSqliteFile(
    fileBuffer: ArrayBuffer,
    currentUserId: string
  ): Promise<NormalizedChatRoom> {
    const SQL = await this.getSqlEngine();
    const db = new SQL.Database(new Uint8Array(fileBuffer));

    const rawUsers: RawZUser[] = [];
    try {
      const res = db.exec("SELECT * FROM ZUSER");
      if (res.length > 0) {
        const columns = res[0].columns;
        res[0].values.forEach((row: any[]) => {
          const userObj: any = {};
          columns.forEach((col: string, idx: number) => {
            userObj[col] = row[idx];
          });
          rawUsers.push(userObj);
        });
      }
    } catch (e) {
      console.warn("ZUSER table not found or empty", e);
    }

    let rawChat: RawZChat = {};
    try {
      const res = db.exec("SELECT * FROM ZCHAT LIMIT 1");
      if (res.length > 0) {
        const columns = res[0].columns;
        const row = res[0].values[0];
        columns.forEach((col: string, idx: number) => {
          rawChat[col] = row[idx];
        });
      }
    } catch (e) {
      console.warn("ZCHAT table not found", e);
    }

    const rawMessages: RawZMessage[] = [];
    try {
      const res = db.exec("SELECT * FROM ZMESSAGE");
      if (res.length > 0) {
        const columns = res[0].columns;
        res[0].values.forEach((row: any[]) => {
          const msgObj: any = {};
          columns.forEach((col: string, idx: number) => {
            msgObj[col] = row[idx];
          });
          rawMessages.push(msgObj);
        });
      }
    } catch (e) {
      console.warn("ZMESSAGE table not found", e);
    }

    db.close();

    return this.buildChatRoom(rawChat, rawUsers, rawMessages, currentUserId);
  }

  public static buildChatRoom(
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

export default SqliteParser;
