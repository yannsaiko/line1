export interface RawZUser {
  Z_PK?: number;
  z_pk?: number;
  ZMID?: string;
  zmid?: string;
  ZNAME?: string;
  zname?: string;
  ZCUSTOMNAME?: string;
  zcustomname?: string;
  [key: string]: any;
}

export interface RawZMessage {
  Z_PK?: number;
  z_pk?: number;
  ZTEXT?: string;
  ztext?: string;
  ZCREATEDTIME?: number | string;
  zcreatedtime?: number | string;
  ZSENDER?: string;
  zsender?: string;
  ZCHAT?: number | string;
  zchat?: number | string;
  [key: string]: any;
}

export interface RawZChat {
  Z_PK?: number;
  z_pk?: number;
  ZMID?: string;
  zmid?: string;
  ZNAME?: string;
  zname?: string;
  [key: string]: any;
}

export interface NormalizedUser {
  mid: string;
  displayName: string;
  customName?: string;
  resolvedName: string;
}

export interface NormalizedMessage {
  id: string | number;
  text: string;
  senderMid: string;
  senderName: string;
  timestamp: number;
  formattedTime: string;
  formattedFullDate: string;
  isMyMessage: boolean;
}

export interface NormalizedChatRoom {
  chatId?: string | number;
  chatMid: string;
  roomTitle: string;
  partner: NormalizedUser | null;
  messages: NormalizedMessage[];
  lastMessageText?: string;
  lastMessageTime?: string;
  lastTimestamp?: number;
}
