import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { ChatRoom, ParsedFileContext, Message } from '../types';

let sqlPromise: Promise<SqlJsStatic> | null = null;

// WebAssembly (sql.js) の初期化 (unpkg CDNを使用)
export function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: file => `https://unpkg.com/sql.js@1.8.0/dist/${file}`
    });
  }
  return sqlPromise;
}

export interface SchemaInfo {
  msgTable: string;
  chatCol: string;
  textCol: string;
  senderCol: string;
  timeCol: string;
  isMeCol?: string;
  typeCol?: string;
}

// 1. スキーマ（テーブル構造）の自動検出
export function detectSchema(db: Database): SchemaInfo {
  let tables: string[] = [];
  try {
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (res.length > 0) {
      tables = res[0].values.map(row => String(row[0]));
    }
  } catch (e) {
    return { msgTable: '', chatCol: '', textCol: '', senderCol: '', timeCol: '' };
  }

  const msgTableCandidates = ['ZMESSAGE', 'ZCHATMESSAGE', 'messages', 'chat_history', 'Z_13MESSAGES', 'Z_14MESSAGES'];
  let msgTable = tables.find(t => msgTableCandidates.includes(t)) || tables.find(t => /message/i.test(t)) || '';

  if (!msgTable) return { msgTable: '', chatCol: '', textCol: '', senderCol: '', timeCol: '' };

  const colsRes = db.exec(`PRAGMA table_info("${msgTable}")`);
  const cols = colsRes[0] ? colsRes[0].values.map(r => String(r[1])) : [];

  const findCol = (candidates: string[]) => cols.find(c => candidates.includes(c)) || '';

  const textCol = findCol(['ZTEXT', 'text', 'body', 'content', 'message', 'ZBODY', 'ZCONTENT']);
  const chatCol = findCol(['ZCHAT', 'chat_id', 'chat_room_id', 'room_id', 'ZCHATROOM', 'ZMID', 'ZROOM']);
  const senderCol = findCol(['ZSENDER', 'sender_id', 'sender', 'user_id', 'ZUSER', 'ZSENDERMID']);
  const timeCol = findCol(['ZCREATEDTIME', 'created_at', 'timestamp', 'created_time', 'time', 'ZTIME', 'ZDATE']);
  const isMeCol = findCol(['ZISOUTGOING', 'is_me', 'is_outgoing', 'ZISME', 'is_from_me']);
  const typeCol = findCol(['ZTYPE', 'type', 'contentType', 'ZCONTENTTYPE', 'ZMSGTYPE']);

  return {
    msgTable,
    textCol: textCol || cols[0] || '',
    chatCol: chatCol || cols[0] || '',
    senderCol: senderCol || cols[0] || '',
    timeCol: timeCol || cols[0] || '',
    isMeCol: isMeCol || undefined,
    typeCol: typeCol || undefined,
  };
}

// 2. ユーザー名・トーク部屋名の辞書テーブル解析
export function loadDictionaries(db: Database, schema: SchemaInfo): { userMap: Record<string, string>; chatMap: Record<string, string> } {
  const userMap: Record<string, string> = {};
  const chatMap: Record<string, string> = {};

  try {
    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = tablesRes.length > 0 ? tablesRes[0].values.map(r => String(r[0])) : [];

    const userTable = tables.find(t => ['ZUSER', 'users', 'profiles', 'contacts', 'ZCONTACT'].includes(t)) || tables.find(t => /user|contact/i.test(t));
    if (userTable) {
      const colsRes = db.exec(`PRAGMA table_info("${userTable}")`);
      const cols = colsRes[0] ? colsRes[0].values.map(r => String(r[1])) : [];
      const idCol = cols.find(c => ['Z_PK', 'id', 'user_id', 'mid', 'ZMID', 'ZUSERID'].includes(c));
      const nameCol = cols.find(c => ['ZNAME', 'name', 'display_name', 'ZDISPLAYNAME', 'ZCUSTOMNAME'].includes(c));

      if (idCol && nameCol) {
        const res = db.exec(`SELECT "${idCol}", "${nameCol}" FROM "${userTable}"`);
        if (res[0]) {
          res[0].values.forEach(row => {
            if (row[0] && row[1]) userMap[String(row[0])] = String(row[1]);
          });
        }
      }
    }

    const chatTable = tables.find(t => ['ZCHAT', 'chats', 'chat_rooms', 'rooms', 'ZCHATROOM'].includes(t)) || tables.find(t => /chat|room/i.test(t));
    if (chatTable) {
      const colsRes = db.exec(`PRAGMA table_info("${chatTable}")`);
      const cols = colsRes[0] ? colsRes[0].values.map(r => String(r[1])) : [];
      const idCol = cols.find(c => ['Z_PK', 'id', 'chat_id', 'room_id', 'ZMID', 'ZCHATID'].includes(c));
      const nameCol = cols.find(c => ['ZNAME', 'name', 'title', 'ZTITLE', 'ZCHATNAME'].includes(c));

      if (idCol && nameCol) {
        const res = db.exec(`SELECT "${idCol}", "${nameCol}" FROM "${chatTable}"`);
        if (res[0]) {
          res[0].values.forEach(row => {
            if (row[0] && row[1]) chatMap[String(row[0])] = String(row[1]);
          });
        }
      }
    }
  } catch (e) {
    console.warn('辞書データの読み込みに失敗しました', e);
  }

  return { userMap, chatMap };
}

// 3. トーク部屋一覧の取得
export function fetchChatRooms(
  db: Database,
  schema: SchemaInfo,
  userMap: Record<string, string>,
  chatMap: Record<string, string>,
  fileId: string,
  fileName: string
): ChatRoom[] {
  if (!schema.msgTable) return [];

  try {
    const query = `
      SELECT "${schema.chatCol}", COUNT(*), MAX("${schema.timeCol}")
      FROM "${schema.msgTable}"
      GROUP BY "${schema.chatCol}"
      ORDER BY MAX("${schema.timeCol}") DESC
    `;
    const res = db.exec(query)[0];
    if (!res || !res.values) return [];

    return res.values.map(r => {
      const roomId = String(r[0]);
      const count = Number(r[1]);
      const maxTimeRaw = r[2];
      const dateObj = parseLineTimestamp(maxTimeRaw);
      const lastTime = dateObj ? `${formatDate(dateObj)} ${formatTime(dateObj)}` : '';

      const name = chatMap[roomId] || userMap[roomId] || `トーク部屋 (${roomId})`;

      return {
        fileId,
        displayLabel: fileName,
        id: roomId,
        name,
        count,
        lastTime,
        isText: false
      };
    });
  } catch (e) {
    console.error('トーク部屋取得エラー:', e);
    return [];
  }
}

// 4. タイムスタンプ・日時フォーマット関連関数
export function parseLineTimestamp(rawTime: any): Date | null {
  if (rawTime === null || rawTime === undefined) return null;

  const num = Number(rawTime);
  if (!isNaN(num) && num > 0) {
    if (num < 1000000000) {
      // CoreData 2001-01-01 基準エポック
      return new Date((num + 978307200) * 1000);
    }
    if (num < 10000000000) {
      // Unix Timestamp (秒)
      return new Date(num * 1000);
    }
    // Unix Timestamp (ミリ秒)
    return new Date(num);
  }

  const parsedStr = Date.parse(String(rawTime));
  if (!isNaN(parsedStr)) {
    return new Date(parsedStr);
  }

  return null;
}

export function formatDateHeader(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${year}年${month}月${day}日(${dayOfWeek})`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// 5. テキスト形式のバックアップファイル（.txt）の解析
export async function parseLineTextFile(
  file: File,
  fileName: string,
  fileId: string
): Promise<{ context: ParsedFileContext; room: ChatRoom } | null> {
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/);

    const roomName = fileName.replace(/\.txt$/i, '').replace(/^\[LINE\]\s*/i, '');
    const messages: Message[] = [];
    let currentDateStr = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const dateMatch = line.match(/^(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})/);
      if (dateMatch && !line.includes('\t')) {
        currentDateStr = dateMatch[1];
        continue;
      }

      const msgMatch = line.match(/^((?:午前|午後|AM|PM\s*)?\d{1,2}:\d{2})\t([^\t]+)\t(.*)/i);
      if (msgMatch) {
        const timeStr = msgMatch[1].trim();
        const sender = msgMatch[2].trim();
        const body = msgMatch[3];
        const isMe = sender === '自分' || sender === 'Me';

        messages.push({
          id: messages.length,
          text: body,
          isMe,
          senderId: isMe ? 'me' : sender,
          senderName: sender,
          timeOnlyStr: timeStr,
          dateStr: currentDateStr || '日付不明',
          fullDateTimeStr: currentDateStr ? `${currentDateStr} ${timeStr}` : timeStr,
          timestamp: messages.length
        });
      } else if (messages.length > 0) {
        messages[messages.length - 1].text += '\n' + line;
      }
    }

    if (messages.length === 0) return null;

    const context: ParsedFileContext = {
      file,
      displayLabel: fileName,
      isText: true,
      messages
    };

    const room: ChatRoom = {
      fileId,
      displayLabel: fileName,
      id: fileId,
      name: roomName,
      count: messages.length,
      lastTime: messages[messages.length - 1]?.fullDateTimeStr || '',
      isText: true
    };

    return { context, room };
  } catch (e) {
    console.error('テキストファイルのパースに失敗しました:', e);
    return null;
  }
}
