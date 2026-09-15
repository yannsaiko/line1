/**
 * 13桁Unixミリ秒・10桁Unix秒・iOS CoreData基準秒に対応した日時フォーマッタ
 */
export const formatPrintDateTime = (rawTime: any): string => {
  if (rawTime === undefined || rawTime === null || rawTime === '' || rawTime === 0) return '';

  const num = typeof rawTime === 'string' ? Number(rawTime) : rawTime;
  let date: Date;

  if (typeof num === 'number' && !isNaN(num)) {
    // 13桁Unixミリ秒 (例: 1726383600000)
    if (num > 1000000000000) {
      date = new Date(num);
    } 
    // iOS CoreData / Cocoa 基準秒 (2001-01-01 経過秒)
    else if (num > 100000000 && num < 1000000000) {
      date = new Date(num * 1000 + 978307200000);
    } 
    // 10桁Unix秒 (例: 1726383600)
    else if (num >= 1000000000 && num <= 10000000000) {
      date = new Date(num * 1000);
    } 
    else {
      date = new Date(num);
    }
  } else {
    date = new Date(rawTime);
  }

  if (isNaN(date.getTime()) || date.getFullYear() === 1970) return '';

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
};
