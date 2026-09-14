/**
 * あらゆる形式のLINE日時データを正確な「HH:mm」に変換する
 */
export const formatMessageTime = (dateInput: any): string => {
  if (dateInput === null || dateInput === undefined || dateInput === '' || dateInput === 0) {
    return '--:--';
  }

  let num = typeof dateInput === 'string' ? Number(dateInput) : dateInput;
  let date: Date;

  // 1. 数値（タイムスタンプ）の判定処理
  if (typeof num === 'number' && !isNaN(num)) {
    // Unixミリ秒 (13桁: 例 1726383600000)
    if (num > 1000000000000) {
      date = new Date(num);
    }
    // Unix秒 (10桁: 例 1726383600)
    else if (num > 100000000) {
      date = new Date(num * 1000);
    }
    // iOS CoreData / Cocoa Epoch秒 (2001年1月1日からの経過秒数: 例 700000000 付近)
    else if (num > 0 && num < 100000000) {
      const COCOA_EPOCH_OFFSET = 978307200000; // 2001-01-01 UTC までのミリ秒
      date = new Date(num * 1000 + COCOA_EPOCH_OFFSET);
    } 
    else {
      return '--:--';
    }
  } 
  // 2. 文字列（ISO 8601等）の処理
  else if (typeof dateInput === 'string') {
    const normalizedStr = dateInput.includes(' ') && !dateInput.includes('T')
      ? dateInput.replace(' ', 'T')
      : dateInput;
    date = new Date(normalizedStr);
  } 
  else {
    date = new Date(dateInput);
  }

  // 無効な日付・1970年初期値ガード
  if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
    return '--:--';
  }

  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
