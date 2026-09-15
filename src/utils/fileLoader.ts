// @ts-ignore
import initSqlJs from 'sql.js/dist/sql-asm.js';
import { RawZChat, RawZUser, RawZMessage } from '../types/lineDatabase';

export interface ParsedLineRawData {
  rawChats: RawZChat[];
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
      rawChats: data.rawChats || data.ZCHAT || (data.rawChat ? [data.rawChat] : []),
      rawUsers: data.rawUsers || data.ZUSER || [],
      rawMessages: data.rawMessages || data.ZMESSAGE || [],
    };
  }

  const SQL = await initSqlJs();
  const arrayBuffer = await file.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(arrayBuffer));

  let rawChats: RawZChat[] = [];
  try {
    const chatRes = db.exec("SELECT * FROM ZCHAT;");
    if (chatRes.length > 0) rawChats = statementToObjects(chatRes[0]);
  } catch (e) {
    console.warn("ZCHAT table not found", e);
  }

  let rawUsers: RawZUser[] = [];
  try {
    const userRes = db.exec("SELECT * FROM ZUSER;");
    if (userRes.length > 0) rawUsers = statementToObjects(userRes[0]);
  } catch (e) {
    console.warn("ZUSER table not found", e);
  }

  let rawMessages: RawZMessage[] = [];
  try {
    const msgRes = db.exec("SELECT * FROM ZMESSAGE;");
    if (msgRes.length > 0) rawMessages = statementToObjects(msgRes[0]);
  } catch (e) {
    console.warn("ZMESSAGE table not found", e);
  }

  db.close();

  return { rawChats, rawUsers, rawMessages };
};
