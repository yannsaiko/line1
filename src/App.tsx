import React, { useMemo } from 'react';
import { LineDataParser } from './services/lineDataParser';
import ChatRoom from './components/ChatRoom';

export const App = () => {
  const currentUserId = "u1000000000000000000000000000001";

  const rawZChat = { ZMID: "u2000000000000000000000000000002", ZNAME: "" };

  const rawZUsers = [
    { ZMID: "u1000000000000000000000000000001", ZNAME: "自分" },
    { ZMID: "u2000000000000000000000000000002", ZNAME: "佐藤 健", ZCUSTOMNAME: "佐藤健（仕事用）" }
  ];

  const rawZMessages = [
    {
      Z_PK: 101,
      ZSENDER: "u2000000000000000000000000000002",
      ZTEXT: "お疲れ様です。明日のミーティングの件です。",
      ZCREATEDTIME: 748161000
    },
    {
      Z_PK: 102,
      ZSENDER: "u1000000000000000000000000000001",
      ZTEXT: "了解いたしました！14時に参加いたします。",
      ZCREATEDTIME: 1726383060000
    }
  ];

  const parsedRoom = useMemo(() => {
    return LineDataParser.parseChatRoom(rawZChat, rawZUsers, rawZMessages, currentUserId);
  }, [rawZChat, rawZUsers, rawZMessages, currentUserId]);

  return <ChatRoom roomData={parsedRoom} />;
};

export default App;
