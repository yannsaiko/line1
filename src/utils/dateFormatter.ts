/**
 * Line.sqlite の ZCREATEDTIME（13桁ミリ秒）を正確な「HH:mm」に変換
 */
export const formatMessageTime = (createdTime: number | string | null | undefined): string => {
  if (!createdTime || createdTime === 0) return '--:--';

  const numTime = typeof createdTime === 'string' ? Number(createdTime) : createdTime;
  if (isNaN(numTime) || numTime <= 0) return '--:--';

  // 10桁（秒）の場合はミリ秒に補正し、13桁（ミリ秒）はそのまま使用
  const timestampMs = numTime < 10000000000 ? numTime * 1000 : numTime;
  const date = new Date(timestampMs);

  // パース失敗または 1970年初期値の防護
  if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
    return '--:--';
  }

  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
