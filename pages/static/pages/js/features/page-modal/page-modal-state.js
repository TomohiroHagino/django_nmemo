let createEditor = null;
let titleInputEnterPressed = false;

export function setCreateEditor(editor) { createEditor = editor; }
export function getCreateEditor() { return createEditor; }
export function setTitleEnterPressed(v) { titleInputEnterPressed = v; }
export function isTitleEnterPressed() { return titleInputEnterPressed; }
export function resetState() { titleInputEnterPressed = false; }