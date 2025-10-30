export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

export function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ja-JP');
}

// 文字数制限して末尾に…を付ける
export function truncate(text, max = 100) {
  const s = text == null ? '' : String(text);
  return s.length > max ? s.slice(0, max) + '…' : s;
}