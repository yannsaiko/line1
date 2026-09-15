import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { NormalizedChatRoom, NormalizedMessage } from './types/lineDatabase';

export const App: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<NormalizedChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<NormalizedChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 編集状態（モザイク・非表示）
  const [blurredMsgIds, setBlurredMsgIds] = useState<Set<string | number>>(new Set());
  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string | number>>(new Set());

  // モザイク切り替え
  const toggleBlur = (id: string | number) => {
    setBlurredMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // メッセージ非表示（削除）
  const deleteMessage = (id: string | number) => {
    setDeletedMsgIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 印刷実行
  const handlePrint = () => {
    window.print();
  };

  // 究極の超柔軟テキスト解析（iOS / Android / PC / 各種記述フォーマットに対応）
  const parseLineTxt = (text: string, fileName: string): NormalizedChatRoom | null => {
    const lines = text.split(/\r?\n/);
    let roomTitle = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/^\[LINE\]\s*/, '')
      .replace(/とのトーク履歴$/, '');

    const messages: NormalizedMessage[] = [];
    let currentDate = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // タイトル行検出
      if (trimmed.startsWith('[LINE]')) {
        const match = trimmed.match(/\[LINE\]\s*(.+)とのトーク履歴/);
        if (match) roomTitle = match[1];
        continue;
      }

      // ヘッダー除外
      if (trimmed.startsWith('保存日時：') || trimmed.startsWith('保存日時:')) continue;

      // 日付行 (例: 2023/10/24(火), 2023.10.24, 2023年10月24日)
      if (/^\d{4}[\/\.\-年]\d{1,2}[\/\.\-月]\d{1,2}/.test(trimmed)) {
        currentDate = trimmed;
        continue;
      }

      // 1) タブ区切り判定 (\t)
      const tabParts = line.split('\t');
      if (tabParts.length >= 3) {
        messages.push({
          id: `txt_${fileName}_${i}`,
          text: tabParts.slice(2).join('\t'),
          senderMid: tabParts[1],
          senderName: tabParts[1],
          timestamp: i,
          formattedTime: tabParts[0],
          formattedFullDate: currentDate,
          isMyMessage: tabParts[1] === '自分' || tabParts[1] === 'Me',
        });
        continue;
      } else if (tabParts.length === 2) {
        messages.push({
          id: `txt_${fileName}_${i}`,
          text: tabParts[1],
          senderMid: tabParts[0],
          senderName: tabParts[0],
          timestamp: i,
          formattedTime: '',
          formattedFullDate: currentDate,
          isMyMessage: tabParts[0] === '自分' || tabParts[0] === 'Me',
        });
        continue;
      }

      // 2) 複数スペースまたはコロン区切り判定 (Android/他フォーマット)
      const spaceParts = line.split(/\s{2,}/);
      if (spaceParts.length >= 3) {
        messages.push({
          id: `txt_${fileName}_${i}`,
          text: spaceParts.slice(2).join(' '),
          senderMid: spaceParts[1],
          senderName: spaceParts[1],
          timestamp: i,
          formattedTime: spaceParts[0],
          formattedFullDate: currentDate,
          isMyMessage: spaceParts[1] === '自分' || spaceParts[1] === 'Me',
        });
        continue;
      }

      // 3) 複数行メッセージの結合または標準テキスト行としての救済
      if (messages.length > 0) {
        messages[messages.length - 1].text += '\n' + line;
      } else {
        messages.push({
          id: `txt_${fileName}_${i}`,
          text: line,
          senderMid: '送信者',
          senderName: '送信者',
          timestamp: i,
          formattedTime: '',
          formattedFullDate: currentDate,
          isMyMessage: false,
        });
      }
    }

    if (messages.length === 0) return null;

    return {
      chatId: fileName,
      chatMid: fileName,
      roomTitle: roomTitle || 'LINE トーク履歴',
      partner: null,
      messages,
      lastMessageText: messages[messages.length - 1]?.text || '',
      lastMessageTime: messages[messages.length - 1]?.formattedTime || '',
      lastTimestamp: messages.length,
    };
  };

  // ファイル読み込み・全自動フォールバック処理
  const handleFilesSelected = async (files: FileList | File[]) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const fileArray = Array.from(files);
      const parsedRooms: NormalizedChatRoom[] = [];

      for (const file of fileArray) {
        let parsed = false;

        // 1. SQLiteとしての解析を試行
        if (
          file.name.endsWith('.sqlite') ||
          file.name.endsWith('.sqlite3') ||
          file.name.endsWith('.db') ||
          file.name.toLowerCase().includes('talk') ||
          file.name.toLowerCase().includes('chat')
        ) {
          try {
            // @ts-ignore
            const initSqlJs = (await import('sql.js')).default;
            const SQL = await initSqlJs({
              locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`,
            });

            const buffer = await file.arrayBuffer();
            const db = new SQL.Database(new Uint8Array(buffer));
            const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
            const tables = tablesRes.length > 0 ? tablesRes[0].values.map((v) => String(v[0])) : [];

            const msgTable = tables.find((t) => t.toLowerCase().includes('message') || t.toLowerCase().includes('chatlog'));
            if (msgTable) {
              const res = db.exec(`SELECT * FROM "${msgTable}"`);
              if (res.length > 0) {
                const cols = res[0].columns;
                const rows = res[0].values.map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
                
                const msgs: NormalizedMessage[] = rows.map((r: any, idx) => ({
                  id: r.Z_PK || r.id || idx,
                  text: r.ZTEXT || r.ztext || r.text || '',
                  senderMid: String(r.ZSENDER || r.zsender || ''),
                  senderName: r.ZSENDER || r.zsender ? '相手' : '自分',
                  timestamp: idx,
                  formattedTime: '',
                  formattedFullDate: '',
                  isMyMessage: !r.ZSENDER && !r.zsender,
                }));

                parsedRooms.push({
                  chatId: file.name,
                  chatMid: file.name,
                  roomTitle: file.name.replace(/\.[^/.]+$/, ''),
                  partner: null,
                  messages: msgs,
                  lastMessageText: msgs[msgs.length - 1]?.text || '',
                  lastMessageTime: '',
                  lastTimestamp: msgs.length,
                });
                parsed = true;
              }
            }
            db.close();
          } catch (dbErr) {
            console.warn('DB解析スキップ、テキストモードへフォールバック:', dbErr);
          }
        }

        // 2. テキストパーサーによる救済（DB解析非対象、またはDB解析失敗時）
        if (!parsed) {
          try {
            const text = await file.text();
            const room = parseLineTxt(text, file.name);
            if (room) {
              parsedRooms.push(room);
            }
          } catch (txtErr) {
            console.warn('テキスト解析エラー:', txtErr);
          }
        }
      }

      if (parsedRooms.length === 0) {
        throw new Error('ファイルを読み込めませんでした。文字が入っているテキストファイルを選択してください。');
      }

      setChatRooms(parsedRooms);
      setSelectedRoom(parsedRooms[0]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'ファイルの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const currentMessages = selectedRoom
    ? selectedRoom.messages.filter((m) => !deletedMsgIds.has(m.id))
    : [];

  const filteredRooms = chatRooms.filter(
    (room) =>
      room.roomTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f5f6f8' }}>
      {/* 印刷用CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
          main { background: #fff !important; height: auto !important; overflow: visible !important; }
          .chat-container { height: auto !important; overflow: visible !important; }
          .action-btn { display: none !important; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="no-print" style={{ backgroundColor: '#06C755', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>LINE トーク履歴ビューアー</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {selectedRoom && (
            <button
              onClick={handlePrint}
              style={{ padding: '8px 16px', backgroundColor: '#fff', color: '#06C755', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
            >
              🖨️ 印刷 / PDF保存
            </button>
          )}
          <FileUploader onFilesSelected={handleFilesSelected} isLoading={isLoading} />
        </div>
      </header>

      {errorMessage && (
        <div className="no-print" style={{ backgroundColor: '#ffdddd', color: '#d8000c', padding: '10px 20px', borderBottom: '1px solid #d8000c', fontSize: '14px' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* サイドバー */}
        <aside className="no-print" style={{ width: '320px', borderRight: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              type="text"
              placeholder="トーク部屋やメッセージを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '18px', border: '1px solid #ccc', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredRooms.length === 0 ? (
              <div style={{ padding: '20px', color: '#888', textAlign: 'center', fontSize: '14px' }}>
                {chatRooms.length === 0 ? 'ファイルを選択してください' : '該当するトークがありません'}
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = selectedRoom?.chatId === room.chatId;
                return (
                  <div
                    key={room.chatId}
                    onClick={() => setSelectedRoom(room)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e8f7ed' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333', marginBottom: '4px' }}>
                      {room.roomTitle}
                    </div>
                    <div style={{ fontSize: '13px', color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.lastMessageText || 'メッセージなし'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* トークメイン画面 */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#7494C0' }}>
          {selectedRoom ? (
            <>
              <div style={{ backgroundColor: '#fff', padding: '14px 20px', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '16px', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{selectedRoom.roomTitle}</span>
                <span className="no-print" style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                  ※各吹き出しの「モザイク」「削除」で個別編集できます
                </span>
              </div>

              <div className="chat-container" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentMessages.length === 0 ? (
                  <div style={{ color: '#fff', textAlign: 'center', marginTop: '40px' }}>メッセージがありません</div>
                ) : (
                  currentMessages.map((msg: NormalizedMessage) => {
                    const isBlurred = blurredMsgIds.has(msg.id);

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: msg.isMyMessage ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {msg.formattedFullDate && (
                          <div style={{ alignSelf: 'center', margin: '10px 0', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                            {msg.formattedFullDate}
                          </div>
                        )}

                        {!msg.isMyMessage && (
                          <span style={{ fontSize: '12px', color: '#fff', marginBottom: '3px', marginLeft: '4px' }}>
                            {msg.senderName}
                          </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: msg.isMyMessage ? 'row-reverse' : 'row' }}>
                          {/* 吹き出し */}
                          <div
                            style={{
                              maxWidth: '65%',
                              padding: '9px 14px',
                              borderRadius: '16px',
                              backgroundColor: msg.isMyMessage ? '#85E249' : '#FFFFFF',
                              color: '#000',
                              fontSize: '14px',
                              lineHeight: '1.4',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              filter: isBlurred ? 'blur(6px)' : 'none',
                              userSelect: isBlurred ? 'none' : 'auto',
                              transition: 'filter 0.2s',
                            }}
                          >
                            {msg.text}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isMyMessage ? 'flex-end' : 'flex-start', gap: '2px' }}>
                            <span style={{ fontSize: '11px', color: '#e0e0e0', flexShrink: 0 }}>
                              {msg.formattedTime}
                            </span>

                            {/* 操作ボタン */}
                            <div className="no-print action-btn" style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => toggleBlur(msg.id)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  backgroundColor: isBlurred ? '#ff9800' : 'rgba(255,255,255,0.8)',
                                  color: isBlurred ? '#fff' : '#333',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                {isBlurred ? '解除' : 'モザイク'}
                              </button>
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  backgroundColor: 'rgba(255,255,255,0.8)',
                                  color: '#d32f2f',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px' }}>
              ファイルを選択するとトーク内容が表示されます
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
