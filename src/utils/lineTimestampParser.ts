export interface ParsedDateResult {
  timestamp: number;
  formattedTime: string;
  formattedFullDate: string;
  isValid: boolean;
}

export const parseLineTimestamp = (rawTime: any): ParsedDateResult => {
  const invalidResult: ParsedDateResult = {
    timestamp: 0,
    formattedTime: '--:--',
    formattedFullDate: '日時不明',
    isValid: false,
  };

  if (rawTime === undefined || rawTime === null || rawTime === '' || rawTime === 0) {
    return invalidResult;
  }

  let num = typeof rawTime === 'string' ? Number(rawTime) : rawTime;
  let date: Date;

  if (typeof num === 'number' && !isNaN(num)) {
    if (num > 1000000000000000) {
      date = new Date(Math.floor(num / 1000000));
    } else if (num > 1000000000000) {
      date = new Date(num);
    } else if (num > 0 && num < 1000000000) {
      const COCOA_OFFSET_MS = 978307200000;
      date = new Date(num * 1000 + COCOA_OFFSET_MS);
    } else if (num >= 1000000000 && num <= 10000000000) {
      date = new Date(num * 1000);
    } else {
      date = new Date(num);
    }
  } else {
    date = new Date(rawTime);
  }

  if (isNaN(date.getTime()) || date.getFullYear() === 1970) {
    return invalidResult;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return {
    timestamp: date.getTime(),
    formattedTime: `${hours}:${minutes}`,
    formattedFullDate: `${year}/${month}/${day} ${hours}:${minutes}`,
    isValid: true,
  };
};

export default parseLineTimestamp;
