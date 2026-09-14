export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Message {
  id: string;
  senderId: string;       // 送信者のID
  text: string;
  createdAt: string;      // ISO 8601形式のタイムスタンプ (例: "2026-09-14T16:55:00Z")
}

export interface Room {
  id: string;
  type: 'single' | 'group'; // 1対1またはグループ
  title?: string;          // グループ時の部屋名
  members: User[];         // 参加しているユーザー一覧
  messages: Message[];
}
