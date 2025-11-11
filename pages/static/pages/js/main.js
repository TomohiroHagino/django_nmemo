// メインエントリーポイント - すべてのモジュールを読み込み、初期化する

import { initPageTreeDragDrop, toggleChildren, addPageToTree } from './features/page-tree/index.js';
import { openIconModal, closeIconModal, confirmIconChange } from './iconModal.js';
import { openCreateModal, openCreateChildModal, closeCreateModal, handleCreatePage, setCreateEditor, getCreateEditor, initModalResize, setupTempCleanupOnUnload } from './pageModal.js';
// カスタムエディタを直接インポート（quillEditor.jsは使わない）
import { initCreateEditor, initContentEditor } from './features/custom-editor/index.js';
import { getCurrentPageId, loadPage, savePage, cancelEdit, deletePage } from './pageOperations.js';

import { escapeHtml, formatDate } from './utils/format.js';
import { showSaveIndicator } from './utils/notify.js';
import { initSidebarResize } from './sidebarResize.js';
import { initResponsive } from './responsive.js';

// グローバルに保持するエディタ参照（カスタムエディタ）
let contentEditor = null;
let previousContentEditor = null; // クリーンアップ用


// モーダルの外側クリックで閉じる機能は無効化
// window.onclick = function(event) {
//     const createModal = document.getElementById('createModal');
//     if (event.target == createModal) {
//         closeCreateModal();
//     }
// }

// キーボードショートカット
document.addEventListener('keydown', async (e) => {
    // 保存: Mac は Cmd+S、Windows/Linux は Ctrl+S
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        
        // 新規作成モーダルが開いている場合
        const createModal = document.getElementById('createModal');
        if (createModal && createModal.style.display === 'block') {
            // フォームを送信
            const createForm = document.getElementById('createForm');
            if (createForm) {
                const formEvent = new Event('submit', { bubbles: true, cancelable: true });
                if (createForm.dispatchEvent(formEvent)) {
                    handleCreatePage(formEvent);
                }
            }
            return;
        }
        
        // 既存ページ編集の場合
        const currentPageId = getCurrentPageId();
        if (currentPageId && contentEditor) {
            await savePage(contentEditor, showSaveIndicator);
        }
    }
});

// ページロード時の初期化
window.addEventListener('load', () => {
    // モーダルのリサイズ機能を初期化
    initModalResize();
    // サイドバーのドラッグリサイズを初期化
    initSidebarResize();
    // レスポンシブ機能を初期化
    initResponsive();
    
    // 作成モーダル用のカスタムエディタを初期化（内部で全て処理される）
    const createEditor = initCreateEditor();
    setCreateEditor(createEditor);
    
    // 一時ファイルクリーンアップの設定
    setupTempCleanupOnUnload();
    
    // ページツリーのドラッグ＆ドロップを初期化
    initPageTreeDragDrop();
    
    // ボタンにイベントリスナーを追加
    const buttons = document.querySelectorAll('.btn--primary');
    const createPageButton = Array.from(buttons).find(btn => btn.textContent.includes('新しいページ'));
    if (createPageButton) {
        createPageButton.addEventListener('click', (e) => {
            e.preventDefault();
            openCreateModal();
        });
    }
});

// インラインのイベントハンドラから呼び出せるように関数をグローバルに公開
window.openCreateModal = openCreateModal;
window.openCreateChildModal = openCreateChildModal;
window.closeCreateModal = closeCreateModal;
window.handleCreatePage = function(event) {
    return handleCreatePage(event, 
        (pageId, title, parentId) => addPageToTree(pageId, title, parentId, escapeHtml),
        showSaveIndicator,
        escapeHtml
    );
};
window.toggleChildren = toggleChildren;
window.loadPage = async function(pageId) {
    // 前のエディタインスタンスをクリーンアップ
    if (previousContentEditor) {
        // Quillエディタの場合
        if (previousContentEditor.off && typeof previousContentEditor.off === 'function') {
            previousContentEditor.off('text-change');
            previousContentEditor.off('selection-change');
        }
        // CustomEditorの場合
        if (previousContentEditor.destroy && typeof previousContentEditor.destroy === 'function') {
            previousContentEditor.destroy();
        }
        previousContentEditor = null;
    }
    
    try {
        const editor = await loadPage(
            pageId,
            (initialContent) => {
                const contentEditorInstance = initContentEditor(initialContent);
                // ページIDを設定（ドラッグ&ドロップなどで必要）
                if (contentEditorInstance.setPageId) {
                    contentEditorInstance.setPageId(pageId);
                }
                return contentEditorInstance;
            },
            escapeHtml,
            formatDate
        );
        previousContentEditor = contentEditor;
        contentEditor = editor;
    } catch (err) {
        console.error('Error loading page:', err);
    }
};
window.savePage = async function() {
    if (!contentEditor) {
        alert('エディタが初期化されていません');
        return;
    }
    try {
        await savePage(contentEditor, showSaveIndicator);
    } catch (err) {
        console.error('Error saving page:', err);
        alert('保存に失敗しました');
    }
};
window.cancelEdit = function() {
    if (!contentEditor) {
        return;
    }
    cancelEdit(contentEditor);
};
window.deletePage = async function(pageId) {
    try {
        await deletePage(pageId, showSaveIndicator);
    } catch (err) {
        console.error('Error deleting page:', err);
        alert('削除に失敗しました');
    }
};
window.openIconModal = openIconModal;
window.closeIconModal = closeIconModal;
window.confirmIconChange = confirmIconChange;
