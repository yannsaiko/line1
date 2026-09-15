import initSqlJs, { SqlJsStatic } from 'sql.js';
import { RawZChat, RawZUser, RawZMessage } from '../types/lineDatabase';

export interface ParsedLineRawData {
  rawChat: RawZChat;
  rawUsers: RawZUser[];
  rawMessages: RawZMessage[];
}

let sqlPromise: Promise<SqlJsStatic> | null = null;

// WASMバイナリをCDNからメモリへ直接読み込む（publicフォルダへの設置が不要）
const getSqlInstance = async (): Promise<SqlJsStatic> => {
  if (sqlPromise) return sqlPromise;

  sqlPromise = (async () => {
    const cdnUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm',
      'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.wasm',
      'https://unpkg.com/sql.js@1.8.0/dist/sql-wasm.wasm',
    ];

    let wasmBinary: ArrayBuffer | null = null;
    for (const url of cdnUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          wasmBinary = await res.arrayBuffer();
          break;
        }
      } catch (e) {
        console.warn(`WASM fetch failed from ${url}`, e);
      }
    }

    if (!wasmBinary) {
      throw new Error('SQLiteライブラリ(WASM)の読み込みに失敗しました。');
    }

    return await initSqlJs({ wasmBinary });
  })();

  return sqlPromise;
};

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

// ドロップ/選択されたファイル群の中から対象ファイル(Line.sqlite / .db / .json)を自動検索
export const findTargetFile = (files: File[]): File => {
  if (files.length === 0) {
    throw new Error('ファイルが見つかりません。');
  }

  // 1. Line.sqlite を最優先
  const lineSqlite = files.find((f) => f.name.toLowerCase() === 'line.sqlite');
  if (lineSqlite) return lineSqlite;

  // 2. 拡張子が .sqlite または .db のファイル
  const anyDb = files.find(
    (f) => f.name.toLowerCase().endsWith('.sqlite') || f.name.toLowerCase().endsWith('.db')
  );
  if (anyDb) return anyDb;

  // 3. .json ファイル
  const jsonFile = files.find((f) => f.name.toLowerCase().endsWith('.json'));
  if (jsonFile) return jsonFile;

  return files[0];
};

export const loadLineDataFromFile = async (file: File): Promise<ParsedLineRawData> => {
  const fileName = file.name.toLowerCase();

  // JSON ファイルの処理
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text);
    return {
      rawChat: data.rawChat || data.ZCHAT || data.zchat || {},
      rawUsers: data.rawUsers || data.ZUSER || data.zuser || [],
      rawMessages: data.rawMessages || data.ZMESSAGE || data.zmessage || [],
    };
  }

  // SQLite ファイルの処理
  const SQL = await getSqlInstance();
  const arrayBuffer = await file.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(arrayBuffer));

  const chatRes = db.exec('SELECT * FROM ZCHAT LIMIT 1;');
  const rawChat: RawZChat = chatRes.length > 0 ? statementToObjects(chatRes[0])[0] || {} : {};

  const userRes = db.exec('SELECT * FROM ZUSER;');
  const rawUsers: RawZUser[] = userRes.length > 0 ? statementToObjects(userRes[0]) : [];

  const msgRes = db.exec('SELECT * FROM ZMESSAGE;');
  const rawMessages: RawZMessage[] = msgRes.length > 0 ? statementToObjects(msgRes[0]) : [];

  db.close();

  return { rawChat, rawUsers, rawMessages };
};
