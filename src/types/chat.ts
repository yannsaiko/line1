export interface LineUser {
  ZMID: string;            // ユーザー固有ID
  ZNAME?: string;          // 相手が設定した名前
  ZCUSTOMNAME?: string;    // 自分が設定した変更名
}

export interface LineMessage {
  Z_PK?: number;           // メッセージ主キー
  ZTEXT?: string;          // 本文
  ZCREATEDTIME: number;    // 13桁ミリ秒タイムスタンプ
  ZSENDER?: string;        // 送信者のZMID
  ZSENDERHEADER?: string;  // 送信ヘッダー（フォールバック用）
}

export interface LineChat {
  ZMID: string;            // チャットルームID
  ZNAME?: string;          // グループ名/部屋名
  members?: LineUser[];    // 参加ユーザー配列
  messages?: LineMessage[];
}
