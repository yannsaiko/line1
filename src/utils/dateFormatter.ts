/**
 * どんな形式のタイムスタンプでも正確な「HH:mm」に変換する
 */
export const formatMessageTime = (dateInput: any): string => {
  if (!dateInput) return '--:--';

  let date: Date;

  // 数値（UNIXタイムスタンプ）の場合
  if (typeof dateInput === 'number') {
    date = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput);
  }
  // 文字列の場合
  else if (typeof dateInput === 'string') {
    // "2026-09-14 16:55:00" のようなスペース区切りを ISO 形式に補正
    const normalizedStr = dateInput.includes(' ') && !dateInput.includes('T')
      ? dateInput.replace(' ', 'T')
      : dateInput;
    date = new Date(normalizedStr);
  } else {
    date = new Date(dateInput);
  }

  // 不正な日付のチェック
  if (isNaN(date.getTime())) {
    console.error('【時刻エラー】無効な日付フォーマット:', dateInput);
    return '--:--';
  }

  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
