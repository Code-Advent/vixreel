
export const formatNumber = (num: number): string => {
  if (!num) return '0';
  if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 't';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
};

/**
 * Sanitizes a filename for safe storage keys.
 * Removes emojis, special characters, and replaces spaces with hyphens.
 */
export const sanitizeFilename = (filename: string): string => {
  // Remove extension temporarily
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  const name = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;

  const sanitized = name
    .normalize('NFD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s-]/g, '') // Remove all non-word characters (emojis, etc)
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single one

  return `${sanitized}${ext}`;
};
