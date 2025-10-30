// pages/static/pages/js/features/page-operation/state.js
let currentPageId = null;
let originalTitle = '';
let originalContent = '';

export function getCurrentPageId() {
    return currentPageId;
}

export function setCurrentPageId(id) {
    currentPageId = id;
}

export function setOriginals(title, content) {
    originalTitle = title;
    originalContent = content;
}

export function getOriginals() {
    return { originalTitle, originalContent };
}

export function clearState() {
    currentPageId = null;
    originalTitle = '';
    originalContent = '';
}
