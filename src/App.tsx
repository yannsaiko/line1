import React from 'react';
import { ChatRoom } from './components/ChatRoom';

export const App = () => {
  // 自分の ZMID (例: "u0000001")
  const currentUserId = "u0000001";

  // SQLiteから取得された部屋データの結合オブジェクトの構造例
  const sampleRoom = {
    ZNAME: "トーク相手",
    members: [
      { ZMID: "u0000001", ZNAME: "自分" },
      { ZMID: "u0000002", ZNAME: "山田太郎", ZCUSTOMNAME: "山田太郎（仕事）" }
    ],
    messages: [
      {
        Z_PK: 1,
        ZSENDER: "u0000002",
        ZTEXT: "お世話になっております。",
        ZCREATEDTIME: 1726383600000 // 13桁ミリ秒
      },
      {
        Z_PK: 2,
        ZSENDER: "u0000001",
        ZTEXT: "確認いたしました！",
        ZCREATEDTIME: 1726383660000
      }
    ]
  };

  return <ChatRoom room={sampleRoom} currentUserId={currentUserId} />;
};
