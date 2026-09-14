/**
 * タイムスタンプを安全にフォーマットする
 */
export const formatMessageTime = (dateInput: any): string => {
  // 空値・null・undefined・0 の場合は 1970年 にせず '--:--' を返す
  if (!dateInput || dateInput === 0) return '--:--';

  let date: Date;

  // 1. Firebase Firestore Timestamp型 ({ seconds: ..., nanoseconds: ... } または .toDate())
  if (typeof dateInput === 'object' && dateInput !== null) {
    if (typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } else if ('seconds' in dateInput && typeof dateInput.seconds === 'number') {
      date = new Date(dateInput.seconds * 1000);
    } else if ('_seconds' in dateInput && typeof dateInput._seconds === 'number') {
      date = new Date(dateInput._seconds * 1000);
    } else {
      date = new Date(dateInput);
    }
  }
  // 2. UNIXタイムスタンプ（数値）
  else if (typeof dateInput === 'number') {
    date = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput);
  }
  // 3. 文字列
  else if (typeof dateInput === 'string') {
    const normalizedStr = dateInput.includes(' ') && !dateInput.includes('T')
      ? dateInput.replace(' ', 'T')
      : dateInput;
    date = new Date(normalizedStr);
  } 
  else {
    date = new Date(dateInput);
  }

  // 無効な日付、または 1970年（エポックタイム）になってしまった場合の判定ガード
  if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
    return '--:--';
  }

  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
