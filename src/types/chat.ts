// LINE SQLite用データ型
export interface LineUser {
  ZMID?: string;
  ZNAME?: string;
  ZCUSTOMNAME?: string;
  id?: string;
  name?: string;
}

export interface LineMessage {
  Z_PK?: number;
  ZTEXT?: string;
  ZCREATEDTIME?: number;
  ZSENDER?: string;
  ZSENDERHEADER?: string;
  id?: string;
  text?: string;
  createdAt?: string | number;
  senderId?: string;
}

export interface LineChat {
  ZMID?: string;
  ZNAME?: string;
  members?: LineUser[];
  messages?: LineMessage[];
  id?: string;
  title?: string;
  type?: 'single' | 'group';
}

// 互換性維持のためのエイリアス（User, Message, Room でのインポートを許可）
export type User = LineUser;
export type Message = LineMessage;
export type Room = LineChat;
