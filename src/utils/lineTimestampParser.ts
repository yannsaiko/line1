export function parseLineTimestamp(rawTime: any): {
  timestamp: number;
  formattedTime: string;
  formattedFullDate: string;
} {
  if (rawTime === undefined || rawTime === null || rawTime === '') {
    return { timestamp: 0, formattedTime: '--:--', formattedFullDate: '' };
  }

  let val = Number(rawTime);
  if (isNaN(val) || val === 0) {
    return { timestamp: 0, formattedTime: '--:--', formattedFullDate: '' };
  }

  let date: Date;
  const COCOA_OFFSET = 978307200000; // Apple Core Data Epoch (2001-01-01 00:00:00 UTC)

  if (val > 1000000000000) {
    // Unix milliseconds
    date = new Date(val);
  } else if (val > 100000000) {
    if (val < 1000000000) {
      // iOS Apple Epoch seconds
      date = new Date(COCOA_OFFSET + val * 1000);
    } else {
      // Unix seconds
      date = new Date(val * 1000);
    }
  } else {
    date = new Date(val);
  }

  if (isNaN(date.getTime())) {
    return { timestamp: 0, formattedTime: '--:--', formattedFullDate: '' };
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return {
    timestamp: date.getTime(),
    formattedTime: `${hours}:${minutes}`,
    formattedFullDate: `${year}/${month}/${day} ${hours}:${minutes}`,
  };
}
