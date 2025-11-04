// pages/static/pages/js/features/page-operation/index.js
import { fetchPage, updatePage, removePage } from '../../api/pages.js';

import { markActiveHeader, renderContentArea, renderEmpty, renderLoadError, updateTreeTitle } from './dom.js';
import { getCurrentPageId, setCurrentPageId, setOriginals, getOriginals, clearState } from './state.js';

// グローバルに保持するイベントリスナーの参照（クリーンアップ用）
let titleInputHandler = null;
let titleKeydownHandler = null;

export function loadPage(pageId, initContentEditor, escapeHtml, formatDate) {
    markActiveHeader(pageId);
    setCurrentPageId(pageId);

    // 前のページのイベントリスナーを削除
    const oldTitleEl = document.getElementById('pageTitle');
    if (oldTitleEl && titleInputHandler) {
        oldTitleEl.removeEventListener('input', titleInputHandler);
        titleInputHandler = null;
    }
    if (oldTitleEl && titleKeydownHandler) {
        oldTitleEl.removeEventListener('keydown', titleKeydownHandler);
        titleKeydownHandler = null;
    }

    return fetchPage(pageId)
        .then(data => {
            setOriginals(data.title, data.content);
            renderContentArea(pageId, data, escapeHtml, formatDate);

            const contentEditor = initContentEditor(data.content);
            
            // ページIDを設定（ドラッグ&ドロップなどで必要）
            if (contentEditor && contentEditor.setPageId) {
                contentEditor.setPageId(pageId);
            }

            const titleEl = document.getElementById('pageTitle');
            if (titleEl) {
                // 新しいハンドラーを保存
                titleInputHandler = () => {
                    // 将来的な自動保存フックはここ
                };
                titleKeydownHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (contentEditor) contentEditor.focus();
                    }
                };
                
                titleEl.addEventListener('input', titleInputHandler);
                titleEl.addEventListener('keydown', titleKeydownHandler);
            }

            return contentEditor;
        })
        .catch(err => {
            console.error('Error loading page:', err);
            renderLoadError();
            return null;
        });
}

export function savePage(contentQuill, showSaveIndicator) {
    const pageId = getCurrentPageId();
    if (!pageId) return;

    const titleEl = document.getElementById('pageTitle');
    if (!titleEl || !contentQuill) return;

    const title = titleEl.textContent.trim();
    const content = contentQuill.root.innerHTML;

    if (!title) {
        alert('タイトルは必須です');
        return;
    }

    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    showSaveIndicator('保存中...');

    updatePage(pageId, title, content, csrfToken)
        .then(data => {
            if (data.success) {
                showSaveIndicator('保存しました ✓');
                setOriginals(title, content);
                updateTreeTitle(pageId, title);
            } else {
                alert('保存に失敗しました: ' + (data.error || '不明なエラー'));
            }
        })
        .catch(err => {
            console.error('Error saving page:', err);
            alert('保存に失敗しました');
        });
}

export function cancelEdit(contentQuill) {
    const titleEl = document.getElementById('pageTitle');
    const { originalTitle, originalContent } = getOriginals();

    if (titleEl) titleEl.textContent = originalTitle;
    if (contentQuill) {
        contentQuill.root.innerHTML = originalContent;
    }
}

export function deletePage(pageId, showSaveIndicator) {
    if (!confirm('このページを削除しますか？\n子ページがある場合、すべて削除されます。')) {
        return;
    }

    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    removePage(pageId, csrfToken)
        .then(data => {
            if (data.success) {
                const pageHeader = document.getElementById('header-' + pageId);
                if (pageHeader) {
                    const pageItem = pageHeader.parentElement;
                    pageItem.remove();
                }
                renderEmpty();
                clearState();
                showSaveIndicator('ページを削除しました ✓');
            } else {
                alert('削除に失敗しました');
            }
        })
        .catch(err => {
            console.error('Error deleting page:', err);
            alert('削除に失敗しました');
        });
}

export { getCurrentPageId } from './state.js';