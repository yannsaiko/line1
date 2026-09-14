/**
 * タイムスタンプを正しいローカル時刻（HH:mm）に変換する
 */
export const formatMessageTime = (isoString: string): string => {
  if (!isoString) return '--:--';

  const date = new Date(isoString);

  // 不正な日付フォーマットのハンドリング
  if (isNaN(date.getTime())) {
    console.error('Invalid Date Format:', isoString);
    return '--:--';
  }

  // 日本時間に合わせた時:分フォーマット（24時間表記）
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
