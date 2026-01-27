
export const formatNumber = (num: number): string => {
  if (!num) return '0';
  if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 't';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
};
