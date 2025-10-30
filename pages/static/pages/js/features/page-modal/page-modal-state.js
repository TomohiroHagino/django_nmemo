let createQuill = null;
let titleInputEnterPressed = false;

export function setCreateQuill(q) { createQuill = q; }
export function getCreateQuill() { return createQuill; }
export function setTitleEnterPressed(v) { titleInputEnterPressed = v; }
export function isTitleEnterPressed() { return titleInputEnterPressed; }
export function resetState() { titleInputEnterPressed = false; }