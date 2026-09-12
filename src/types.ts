export interface Message {
  id: number;
  text: string;
  isMe: boolean;
  senderId: string;
  senderName: string;
  timeOnlyStr: string;
  dateStr: string;
  fullDateTimeStr: string;
  timestamp: number;
}

export interface ChatRoom {
  fileId: string;
  displayLabel: string;
  id: string;
  name: string;
  count: number;
  lastTime: string;
  isText?: boolean;
}

export interface ParsedFileContext {
  file: File;
  displayLabel: string;
  isText: boolean;
  messages?: Message[];
  schema?: any;
  userMap?: Record<string, string>;
  chatMap?: Record<string, string>;
}
