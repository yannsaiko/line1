import initSqlJs from 'sql.js';
import { RawZChat, RawZUser, RawZMessage } from '../types/lineDatabase';

export interface ParsedLineRawData {
  rawChat: RawZChat;
  rawUsers: RawZUser[];
  rawMessages: RawZMessage[];
}

function statementToObjects(result: any): any[] {
  if (!result || !result.columns || !result.values) return [];
  const columns = result.columns;
  return result.values.map((row: any[]) => {
    const obj: Record<string, any> = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export const loadLineDataFromFile = async (file: File): Promise<ParsedLineRawData> => {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text);
    return {
      rawChat: data.rawChat || data.ZCHAT || data.zchat || {},
      rawUsers: data.rawUsers || data.ZUSER || data.zuser || [],
      rawMessages: data.rawMessages || data.ZMESSAGE || data.zmessage || [],
    };
  }

  // CORS対応の unpkg CDN から wasm を読み込むように修正
  const SQL = await initSqlJs({
    locateFile: (file) => `https://unpkg.com/sql.js@1.8.0/dist/${file}`,
  });

  const arrayBuffer = await file.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(arrayBuffer));

  const chatRes = db.exec("SELECT * FROM ZCHAT LIMIT 1;");
  const rawChat: RawZChat = chatRes.length > 0 ? statementToObjects(chatRes[0])[0] || {} : {};

  const userRes = db.exec("SELECT * FROM ZUSER;");
  const rawUsers: RawZUser[] = userRes.length > 0 ? statementToObjects(userRes[0]) : [];

  const msgRes = db.exec("SELECT * FROM ZMESSAGE;");
  const rawMessages: RawZMessage[] = msgRes.length > 0 ? statementToObjects(msgRes[0]) : [];

  db.close();

  return { rawChat, rawUsers, rawMessages };
};
