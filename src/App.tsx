import React, { useState, useEffect } from 'react';
import { getSql, detectSchema, loadDictionaries, fetchChatRooms, parseLineTimestamp, formatDateHeader, formatDate, formatTime, parseLineTextFile } from './utils/lineParser';
import { ChatRoom, Message, ParsedFileContext } from './types';
import JSZip from 'jszip';

export default function App() {
  const [fileMap, setFileMap] = useState<Record<string, ParsedFileContext>>({});
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedFileFilter, setSelectedFileFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // UI状態
  const [progress, setProgress] = useState<{ show: boolean; title: string; percent: number }>({ show: false, title: '', percent: 0 });
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<number>>(new Set());
  const [mosaicMsgIds, setMosaicMsgIds] = useState<Set<number>>(new Set());
  const [hiddenMsgIds, setHiddenMsgIds] = useState<Set<number>>(new Set());
  const [msgSearch, setMsgSearch] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // 印刷オプション
  const [printScopeSelected, setPrintScopeSelected] = useState<boolean>(false);
  const [printTextMode, setPrintTextMode] = useState<boolean>(false);
  const [printHeader, setPrintHeader] = useState<boolean>(true);
  const [printTime, setPrintTime] = useState<boolean>(true);
  const [printSender, setPrintSender] = useState<boolean>(true);
  const [printHideMasked, setPrintHideMasked] = useState<boolean>(true);
  const [printBg, setPrintBg] = useState<boolean>(true);

  // ファイル読み込みハンドラー
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setProgress({ show: true, title: 'ファイルを解析中...', percent: 10 });
    const SQL = await getSql();

    const newFileMap: Record<string, ParsedFileContext> = { ...fileMap };
    const newRooms: ChatRoom[] = [...chatRooms];
    let counter = Object.keys(newFileMap).length;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fname = file.name.toLowerCase();
      counter++;
      const fileId = `file_${counter}`;

      if (fname.endsWith('.txt')) {
        const res = await parseLineTextFile(file, file.name, fileId);
        if (res) {
          newFileMap[fileId] = res.context;
          newRooms.push(res.room);
        }
      } else if (fname.endsWith('.sqlite') || fname.endsWith('.db') || fname.endsWith('.sqlite3') || fname.includes('line')) {
        try {
          const buf = await file.arrayBuffer();
          const db = new SQL.Database(new Uint8Array(buf));
          const schema = detectSchema(db);
          if (schema.msgTable) {
            const { userMap, chatMap } = loadDictionaries(db, schema);
            newFileMap[fileId] = { file, displayLabel: file.name, isText: false, schema, userMap, chatMap };
            const rooms = fetchChatRooms(db, schema, userMap, chatMap, fileId, file.name);
            newRooms.push(...rooms);
          }
          db.close();
        } catch (e) {
          console.error(e);
        }
      }
      setProgress({ show: true, title: '解析中...', percent: Math.round(((i + 1) / fileList.length) * 100) });
    }

    setFileMap(newFileMap);
    setChatRooms(newRooms);
    setProgress({ show: false, title: '', percent: 0 });
  };

  // トーク部屋選択時のメッセージ読み込み
  const selectChatRoom = async (room: ChatRoom) => {
    setActiveChat(room);
    setSelectedMsgIds(new Set());
    setMosaicMsgIds(new Set());
    setHiddenMsgIds(new Set());

    const fileCtx = fileMap[room.fileId];
    if (!fileCtx) return;

    if (fileCtx.isText && fileCtx.messages) {
      setMessages(fileCtx.messages);
      return;
    }

    const SQL = await getSql();
    try {
      const buf = await fileCtx.file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      const sch = fileCtx.schema;
      const safeId = String(room.id).replace(/'/g, "''");

      const query = `
        SELECT "${sch.textCol}", ${sch.isMeCol ? `"${sch.isMeCol}"` : 'NULL'}, "${sch.senderCol}", "${sch.timeCol}", "${sch.typeCol || sch.textCol}"
        FROM "${sch.msgTable}"
        WHERE CAST("${sch.chatCol}" AS TEXT) = '${safeId}'
        ORDER BY "${sch.timeCol}" ASC
      `;

      const res = db.exec(query)[0];
      db.close();

      if (!res || !res.values) {
        setMessages([]);
        return;
      }

      const parsedMsgs: Message[] = res.values.map((r, idx) => {
        const rawText = r[0];
        const isMeVal = r[1];
        const senderId = String(r[2] !== null && r[2] !== undefined ? r[2] : '').trim();
        const rawTime = r[3];
        const msgType = Number(r[4]);

        let isMe = false;
        if (isMeVal !== null && isMeVal !== undefined) {
          isMe = (Number(isMeVal) === 1 || isMeVal === true || String(isMeVal) === '1');
        } else {
          isMe = (!senderId || senderId === '0' || senderId === '' || senderId === 'null');
        }

        let text = String(rawText || '');
        if (!text.trim()) {
          if (msgType === 1) text = '[📷 画像]';
          else if (msgType === 2) text = '[🎥 動画]';
          else if (msgType === 3) text = '[🎵 音声メッセージ]';
          else if (msgType === 6) text = '[📍 位置情報]';
          else if (msgType === 7) text = '[🎨 スタンプ]';
          else text = '[メッセージ (スタンプ/写真/システム)]';
        }

        let senderName = '相手';
        if (isMe) {
          senderName = '自分';
        } else if (fileCtx.userMap?.[senderId]) {
          senderName = fileCtx.userMap[senderId];
        } else if (room.name && !room.name.startsWith('トーク部屋')) {
          senderName = room.name;
        }

        const dateObj = parseLineTimestamp(rawTime);

        return {
          id: idx,
          text,
          isMe,
          senderId,
          senderName,
          timeOnlyStr: dateObj ? formatTime(dateObj) : '',
          dateStr: dateObj ? formatDateHeader(dateObj) : '日時不明',
          fullDateTimeStr: dateObj ? `${formatDate(dateObj)} ${formatTime(dateObj)}` : '日時不明',
          timestamp: dateObj ? dateObj.getTime() : 0
        };
      });

      setMessages(parsedMsgs);
    } catch (e) {
      console.error(e);
    }
  };

  // フィルタリング後のルーム一覧
  const filteredRooms = chatRooms.filter(r => {
    const matchFile = selectedFileFilter === 'ALL' || r.fileId === selectedFileFilter;
    const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFile && matchSearch;
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#f5f5f5' }}>
      {/* ヘッダー */}
      <header style={{ background: '#06c755', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '18px', margin: 0 }}>LINE トーク履歴マルチビューア</h1>
        {Object.keys(fileMap).length > 0 && (
          <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => window.location.reload()}>
            リセット
          </button>
        )}
      </header>

      {/* ドラッグ＆ドロップ（未読み込み時） */}
      {Object.keys(fileMap).length === 0 ? (
        <div 
          onDragOver={e => e.preventDefault()} 
          onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
          style={{ flex: 1, border: '3px dashed #06c755', margin: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}
        >
          <h2>ファイルまたはフォルダーをドロップ</h2>
          <p style={{ color: '#666', marginTop: '8px' }}>Line.sqlite や .txt バックアップをドロップまたは選択してください</p>
          <label style={{ background: '#06c755', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '16px', fontWeight: 'bold' }}>
            ファイルを選択
            <input type="file" multiple accept=".sqlite,.db,.sqlite3,.zip,.txt" onChange={e => e.target.files && handleFileUpload(e.target.files)} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        /* メインアプリ表示 */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* サイドバー */}
          <div style={{ width: '320px', background: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
              <input 
                type="text" 
                placeholder="トーク部屋を検索..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredRooms.map(room => (
                <div 
                  key={`${room.fileId}_${room.id}`}
                  onClick={() => selectChatRoom(room)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    background: activeChat?.id === room.id && activeChat?.fileId === room.fileId ? '#e8f8ee' : '#fff'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{room.name}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{room.count}件</span>
                    <span>{room.lastTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* メインコンテンツ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#abc1ee' }}>
            {activeChat ? (
              <>
                {/* トークヘッダー */}
                <div style={{ background: '#fff', padding: '10px 16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>{activeChat.name}</h3>
                    <span style={{ fontSize: '11px', color: '#666' }}>{messages.length}件のメッセージ</span>
                  </div>
                  <button 
                    onClick={() => window.print()} 
                    style={{ background: '#06c755', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🖨️ 印刷
                  </button>
                </div>

                {/* メッセージビュー */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.map((m, idx) => {
                    const showDate = idx === 0 || messages[idx - 1].dateStr !== m.dateStr;
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && (
                          <div style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.8)', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: '#444' }}>
                            {m.dateStr}
                          </div>
                        )}
                        <div style={{ alignSelf: m.isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', color: '#444', marginBottom: '2px', textAlign: m.isMe ? 'right' : 'left' }}>
                            {m.senderName}
                          </span>
                          <div style={{
                            background: m.isMe ? '#85e249' : '#fff',
                            color: '#000',
                            padding: '8px 12px',
                            borderRadius: '14px',
                            fontSize: '14px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {m.text}
                          </div>
                          <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)', marginTop: '2px', textAlign: m.isMe ? 'right' : 'left' }}>
                            {m.fullDateTimeStr}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', background: 'rgba(255,255,255,0.8)', padding: '20px', borderRadius: '12px', fontWeight: 'bold', color: '#555' }}>
                左のリストからトークを選択してください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
