export interface LineUser {
  ZMID?: string;
  zmid?: string;
  ZNAME?: string;
  zname?: string;
  ZCUSTOMNAME?: string;
  zcustomname?: string;
  id?: string;
  name?: string;
}

export interface LineMessage {
  Z_PK?: number;
  z_pk?: number;
  ZTEXT?: string;
  ztext?: string;
  ZCREATEDTIME?: number;
  zcreatedtime?: number;
  ZSENDER?: string;
  zsender?: string;
  ZSENDERHEADER?: string;
  zsenderheader?: string;
  id?: string;
  text?: string;
  createdAt?: string | number;
}

export interface LineChat {
  ZMID?: string;
  zmid?: string;
  ZNAME?: string;
  zname?: string;
  members?: LineUser[];
  users?: LineUser[];
  participants?: LineUser[];
  messages?: LineMessage[];
  messageList?: LineMessage[];
  title?: string;
}

export type User = LineUser;
export type Message = LineMessage;
export type Room = LineChat;
