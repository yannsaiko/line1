import initSqlJs, { Database } from 'sql.js';
import JSZip from 'jszip';
import { ChatRoom, Message, ParsedFileContext } from '../types';

let SQLModule: any = null;

export async function getSql() {
  if (!SQLModule) {
    SQLModule = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
  }
  return SQLModule;
}

// ⏱️ Apple CoreData / UNIX timestamp (秒・ミリ秒・マイクロ秒・ナノ秒) を高精度に判定・変換
export function parseLineTimestamp(ts: any): Date | null {
  if (ts === null || ts === undefined || ts === '') return null;

  if (typeof ts === 'string' && (ts.includes('-') || ts.includes('/')) && isNaN(Number(ts))) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }

  const num = Number(ts);
  if (isNaN(num) || num === 0) return null;

  const APPLE_EPOCH_MS = 978307200000; // 2001-01-01T00:00:00Z

  // 1. Unix Timestamp (ナノ秒 / マイクロ秒 / ミリ秒 / 秒)
  if (num >= 1e16) return new Date(Math.floor(num / 1e6)); // ナノ秒
  if (num >= 1e13) return new Date(Math.floor(num / 1e3)); // マイクロ秒
  if (num >= 1e11 && num <= 2.5e12) return new Date(num);   // ミリ秒 (2001-2049)
  if (num >= 1e9 && num <= 2.5e9) return new Date(num * 1000); // 秒

  // 2. Apple CoreData Timestamp (基準: 2001-01-01)
  if (num >= 3e11 && num <= 1.5e12) return new Date(APPLE_EPOCH_MS + num); // Apple ミリ秒
  if (num >= 3e8 && num <= 1.5e9) return new Date(APPLE_EPOCH_MS + num * 1000); // Apple 秒
  if (num >= 3e14) return new Date(APPLE_EPOCH_MS + Math.floor(num / 1000)); // Apple マイクロ秒

  return null;
}

export function formatDateHeader(d: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 🔍 iOS / Android スキーマ判定
export function detectSchema(db: Database) {
  let tables: string[] = [];
  try {
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0];
    tables = res ? res.values.map(r => String(r[0])) : [];
  } catch (e) {
    return {};
  }

  const iosMsgTable = tables.find(t => /^ZMESSAGE$/i.test(t) || /^ZSTOREDMESSAGE$/i.test(t));
  const iosUserTable = tables.find(t => /^ZUSER$/i.test(t) || /^ZUSERHEADER$/i.test(t) || /^ZCONTACT$/i.test(t));
  const iosChatTable = tables.find(t => /^ZCHAT$/i.test(t));

  if (iosMsgTable || iosUserTable || iosChatTable) {
    let cols: string[] = [];
    if (iosMsgTable) {
      cols = db.exec(`PRAGMA table_info("${iosMsgTable}")`)[0].values.map(c => String(c[1]));
    }
    return {
      type: 'iOS',
      msgTable: iosMsgTable,
      chatCol: cols.find(c => /^ZCHAT$/i.test(c) || /^ZCHATID$/i.test(c)) || 'ZCHAT',
      textCol: cols.find(c => /^ZTEXT$/i.test(c) || /^ZBODY$/i.test(c)) || 'ZTEXT',
      timeCol: cols.find(c => /^ZCREATEDTIME$/i.test(c) || /^ZDATE$/i.test(c)) || 'ZCREATEDTIME',
      isMeCol: cols.find(c => /^ZISFROMME$/i.test(c) || /^ZIS_ME$/i.test(c)) || null,
      senderCol: cols.find(c => /^ZSENDER$/i.test(c) || /^ZSENDERID$/i.test(c)) || 'ZSENDER',
      typeCol: cols.find(c => /^ZCONTENTTYPE$/i.test(c) || /^ZTYPE$/i.test(c)) || 'ZCONTENTTYPE',
      userTable: iosUserTable,
      chatTable: iosChatTable
    };
  }

  const androidMsgTable = tables.find(t => /^chat_history$/i.test(t));
  const androidUserTable = tables.find(t => /contacts|friends/i.test(t));
  const androidChatTable = tables.find(t => /^chat$|^groups$/i.test(t));

  if (androidMsgTable || androidUserTable || androidChatTable) {
    let cols: string[] = [];
    if (androidMsgTable) {
      cols = db.exec(`PRAGMA table_info("${androidMsgTable}")`)[0].values.map(c => String(c[1]));
    }
    return {
      type: 'Android',
      msgTable: androidMsgTable,
      chatCol: cols.find(c => /chat_id/i.test(c)) || 'chat_id',
      textCol: cols.find(c => /content|message/i.test(c)) || 'content',
      timeCol: cols.find(c => /created_time|created_at/i.test(c)) || 'created_time',
      isMeCol: cols.find(c => /is_sent|status/i.test(c)) || null,
      senderCol: cols.find(c => /from_mid|sender_mid|writer_mid/i.test(c)) || 'from_mid',
      typeCol: cols.find(c => /type|contentType/i.test(c)) || 'type',
      userTable: androidUserTable,
      chatTable: androidChatTable
    };
  }

  return {};
}

// 📖 連絡先・トークルーム辞書の構築
export function loadDictionaries(db: Database, sch: any) {
  const userMap: Record<string, string> = {};
  const chatMap: Record<string, string> = {};

  if (sch.userTable) {
    try {
      const res = db.exec(`SELECT * FROM "${sch.userTable}"`)[0];
      if (res && res.values) {
        const cols = res.columns.map(c => c.toUpperCase());
        const pkIdx = cols.indexOf('Z_PK') !== -1 ? cols.indexOf('Z_PK') : cols.indexOf('ROWID');
        const midIdx = cols.indexOf('ZMID') !== -1 ? cols.indexOf('ZMID') : cols.indexOf('MID');

        const priorityCols = ['ZCUSTOMNAME', 'ZNAME', 'ZADDRESSBOOKNAME', 'ZPHONEBOOKNAME', 'DISPLAY_NAME', 'NAME', 'NICKNAME'];
        const nameIndices = priorityCols.map(p => cols.indexOf(p)).filter(idx => idx !== -1);

        res.values.forEach(r => {
          let nameVal: string | null = null;
          for (const idx of nameIndices) {
            if (r[idx] !== null && r[idx] !== undefined && String(r[idx]).trim() !== '') {
              nameVal = String(r[idx]).trim();
              break;
            }
          }
          if (nameVal) {
            if (pkIdx !== -1 && r[pkIdx] !== null) userMap[String(r[pkIdx]).trim()] = nameVal;
            if (midIdx !== -1 && r[midIdx] !== null) userMap[String(r[midIdx]).trim()] = nameVal;
          }
        });
      }
    } catch (e) {}
  }

  if (sch.chatTable) {
    try {
      const res = db.exec(`SELECT * FROM "${sch.chatTable}"`)[0];
      if (res && res.values) {
        const cols = res.columns.map(c => c.toUpperCase());
        const pkIdx = cols.indexOf('Z_PK') !== -1 ? cols.indexOf('Z_PK') : cols.indexOf('ROWID');
        const midIdx = cols.indexOf('ZMID') !== -1 ? cols.indexOf('ZMID') : cols.indexOf('MID');
        const userLinkIdx = cols.indexOf('ZUSER');

        const priorityCols = ['ZTITLE', 'ZNAME', 'ZCUSTOMNAME', 'TITLE', 'NAME', 'CHAT_NAME'];
        const nameIndices = priorityCols.map(p => cols.indexOf(p)).filter(idx => idx !== -1);

        res.values.forEach(r => {
          let nameVal: string | null = null;
          for (const idx of nameIndices) {
            if (r[idx] !== null && r[idx] !== undefined && String(r[idx]).trim() !== '') {
              nameVal = String(r[idx]).trim();
              break;
            }
          }

          if (!nameVal && userLinkIdx !== -1 && r[userLinkIdx] !== null) {
            const targetUserPk = String(r[userLinkIdx]).trim();
            if (userMap[targetUserPk]) nameVal = userMap[targetUserPk];
          }

          if (nameVal) {
            if (pkIdx !== -1 && r[pkIdx] !== null) chatMap[String(r[pkIdx]).trim()] = nameVal;
            if (midIdx !== -1 && r[midIdx] !== null) chatMap[String(r[midIdx]).trim()] = nameVal;
          }
        });
      }
    } catch (e) {}
  }

  return { userMap, chatMap };
}

// 🏠 トーク部屋一覧の検索・作成
export function fetchChatRooms(db: Database, sch: any, userMap: Record<string, string>, chatMap: Record<string, string>, fileId: string, displayLabel: string): ChatRoom[] {
  if (!sch.msgTable) return [];

  const query = `
    SELECT "${sch.chatCol}", COUNT(*), MAX("${sch.timeCol}")
    FROM "${sch.msgTable}"
    WHERE "${sch.chatCol}" IS NOT NULL AND "${sch.chatCol}" != ''
    GROUP BY "${sch.chatCol}"
    ORDER BY 3 DESC
  `;
  let res;
  try {
    res = db.exec(query)[0];
  } catch (e) {
    return [];
  }
  if (!res || !res.values) return [];

  return res.values.map(r => {
    const chatId = String(r[0]).trim();
    let name = chatMap[chatId] || userMap[chatId] || null;
    const safeId = chatId.replace(/'/g, "''");

    // 1. ZCHATテーブルをZUSERまたはZMIDで検索
    if (!name && sch.chatTable) {
      try {
        const chatRowQ = `SELECT * FROM "${sch.chatTable}" WHERE CAST("${sch.chatCol}" AS TEXT) = '${safeId}' OR CAST(Z_PK AS TEXT) = '${safeId}'`;
        const chatRowRes = db.exec(chatRowQ)[0];
        if (chatRowRes && chatRowRes.values && chatRowRes.values.length > 0) {
          const rowVals = chatRowRes.values[0];
          const cols = chatRowRes.columns.map(c => c.toUpperCase());
          const uIdx = cols.indexOf('ZUSER');
          const mIdx = cols.indexOf('ZMID') !== -1 ? cols.indexOf('ZMID') : cols.indexOf('MID');

          if (uIdx !== -1 && rowVals[uIdx] !== null) {
            const uPk = String(rowVals[uIdx]).trim();
            if (userMap[uPk]) name = userMap[uPk];
          }
          if (!name && mIdx !== -1 && rowVals[mIdx] !== null) {
            const uMid = String(rowVals[mIdx]).trim();
            if (userMap[uMid]) name = userMap[uMid];
          }
        }
      } catch (e) {}
    }

    // 2. メッセージ内の最多送信者から名前を自動推定
    if (!name && sch.senderCol) {
      try {
        const senderQ = `
          SELECT "${sch.senderCol}", COUNT(*) 
          FROM "${sch.msgTable}" 
          WHERE CAST("${sch.chatCol}" AS TEXT) = '${safeId}' 
          AND "${sch.senderCol}" IS NOT NULL AND "${sch.senderCol}" != '' AND "${sch.senderCol}" != '0'
          GROUP BY "${sch.senderCol}" 
          ORDER BY 2 DESC LIMIT 5
        `;
        const senderRes = db.exec(senderQ)[0];
        if (senderRes && senderRes.values) {
          for (const sRow of senderRes.values) {
            const sId = String(sRow[0]).trim();
            if (userMap[sId]) {
              name = userMap[sId];
              break;
            }
          }
        }
      } catch (e) {}
    }

    if (!name) name = `トーク部屋 (${chatId})`;

    const dateObj = parseLineTimestamp(r[2]);
    return {
      fileId,
      displayLabel,
      id: chatId,
      name,
      count: Number(r[1]),
      lastTime: dateObj ? formatDate(dateObj) : '日時不明'
    };
  });
}

// 📄 .txt ファイルのパース関数
export async function parseLineTextFile(file: File, displayLabel: string, fileId: string): Promise<{ context: ParsedFileContext; room: ChatRoom } | null> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  let title = file.name.replace(/\.txt$/i, '').replace(/^\[LINE\]\s*/i, '').replace(/とのトーク履歴$/i, '').replace(/トーク履歴/i, '').trim();
  const messages: Message[] = [];
  let currentDate = '';
  let currentMsg: Message | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (i === 0 || line.startsWith('[LINE]')) {
      const m = line.match(/\[LINE\]\s*(.*?)とのトーク履歴/) || line.match(/\[LINE\]\s*(.*)/);
      if (m && m[1]) title = m[1].replace(/とのトーク履歴$/, '').trim();
    }
    if (/^(保存日時|Saved|日時)：/i.test(line)) continue;

    const dateMatch = line.match(/^(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}(?:\([日月火水木金土]\)|[日月火水木金土]曜日)?)/);
    if (dateMatch && !line.includes('\t')) {
      currentDate = dateMatch[1];
      continue;
    }

    const msgMatch = line.match(/^((?:午前|午後|AM|PM\s*)?\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\t([^\t]+)\t(.*)/i) ||
                     line.match(/^((?:午前|午後|AM|PM\s*)?\d{1,2}:\d{2})\s+([^\s]+)\s+(.*)/i);

    if (msgMatch) {
      if (currentMsg) messages.push(currentMsg);
      const timeStr = msgMatch[1].trim();
      const sender = msgMatch[2].trim();
      const msgText = msgMatch[3];
      const isMe = (sender === '自分' || sender === 'Me');

      currentMsg = {
        id: messages.length,
        text: msgText,
        isMe,
        senderId: isMe ? 'me' : 'other',
        senderName: sender,
        timeOnlyStr: timeStr,
        dateStr: currentDate,
        fullDateTimeStr: currentDate ? `${currentDate} ${timeStr}` : timeStr,
        timestamp: Date.now()
      };
      continue;
    }

    if (currentMsg) {
      currentMsg.text += '\n' + line;
    }
  }
  if (currentMsg) messages.push(currentMsg);

  if (messages.length === 0) return null;

  const room: ChatRoom = {
    fileId,
    displayLabel,
    id: fileId,
    name: title || 'テキストトーク',
    count: messages.length,
    lastTime: messages[messages.length - 1]?.fullDateTimeStr || '',
    isText: true
  };

  const context: ParsedFileContext = {
    file,
    displayLabel,
    isText: true,
    messages
  };

  return { context, room };
}
