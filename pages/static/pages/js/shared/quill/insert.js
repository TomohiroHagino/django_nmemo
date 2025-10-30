export function getSelectionIndex(quill) {
  const range = quill.getSelection(true);
  return range ? range.index : quill.getLength();
}
export function insertImage(quill, index, url) {
  quill.insertEmbed(index, 'image', url);
  quill.insertText(index + 1, '\n');
}
export function insertVideo(quill, index, url) {
  quill.insertEmbed(index, 'video', url);
  quill.insertText(index + 1, '\n');
}
export function insertLink(quill, index, label, url) {
  quill.insertText(index, label, 'link', url);
  quill.insertText(index + label.length, '\n');
}
export function focus(quill) { quill.focus(); }