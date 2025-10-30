// メインエントリーポイント - すべてのモジュールを読み込み、初期化する

import { initPageTreeDragDrop, toggleChildren, addPageToTree } from './pageTree.js';
import { openIconModal, closeIconModal, confirmIconChange } from './iconModal.js';
import { openCreateModal, openCreateChildModal, closeCreateModal, handleCreatePage, setCreateQuill, getCreateQuill, initModalResize } from './pageModal.js';
import { initCreateEditor, initContentEditor, imageHandler, videoHandler, addDragDropImageUpload, addDragDropVideoUpload, addDragDropExcelUpload, addImageResizeHandlers } from './quillEditor.js';
import { getCurrentPageId, loadPage, savePage, cancelEdit, deletePage } from './pageOperations.js';

import { escapeHtml, formatDate } from './utils/format.js';
import { showSaveIndicator } from './utils/notify.js';
import { initSidebarResize } from './sidebarResize.js';
import { initResponsive } from './responsive.js';

// グローバルに保持する Quill エディタ参照
let contentQuill = null;

// モーダルの外側クリックで閉じる機能は無効化
// window.onclick = function(event) {
//     const createModal = document.getElementById('createModal');
//     if (event.target == createModal) {
//         closeCreateModal();
//     }
// }

// キーボードショートカット
document.addEventListener('keydown', (e) => {
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
        if (currentPageId && contentQuill) {
            savePage(contentQuill, showSaveIndicator);
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
    
    // 作成モーダル用の Quill を初期化（適切なコンテキストを付与）
    const createQuill = initCreateEditor(
        function() {
            return imageHandler.call(this, getCurrentPageId(), getCreateQuill);
        },
        function() {
            return videoHandler.call(this, getCurrentPageId(), getCreateQuill);
        },
        addImageResizeHandlers,
        (quill, isCreate) => addDragDropImageUpload(quill, isCreate, getCurrentPageId()),
        (quill, isCreate) => addDragDropVideoUpload(quill, isCreate, getCurrentPageId()),
        (quill, isCreate) => addDragDropExcelUpload(quill, isCreate, getCurrentPageId())
    );
    setCreateQuill(createQuill);
    
    // ページツリーのドラッグ＆ドロップを初期化
    initPageTreeDragDrop();
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
window.loadPage = function(pageId) {
    // loadPage returns a promise, so we need to wait for it
    loadPage(
        pageId,
        (initialContent) => initContentEditor(
            initialContent,
            function() {
                return imageHandler.call(this, getCurrentPageId(), getCreateQuill);
            },
            function() {
                return videoHandler.call(this, getCurrentPageId(), getCreateQuill);
            },
            addImageResizeHandlers,
            (quill, isCreate) => addDragDropImageUpload(quill, isCreate, getCurrentPageId()),
            (quill, isCreate) => addDragDropVideoUpload(quill, isCreate, getCurrentPageId()),
            (quill, isCreate) => addDragDropExcelUpload(quill, isCreate, getCurrentPageId())
        ),
        escapeHtml,
        formatDate
    ).then(quill => {
        contentQuill = quill;
    });
};
window.savePage = function() {
    if (!contentQuill) {
        alert('エディタが初期化されていません');
        return;
    }
    savePage(contentQuill, showSaveIndicator);
};
window.cancelEdit = function() {
    if (!contentQuill) {
        return;
    }
    cancelEdit(contentQuill);
};
window.deletePage = function(pageId) {
    deletePage(pageId, showSaveIndicator);
};
window.openIconModal = openIconModal;
window.closeIconModal = closeIconModal;
window.confirmIconChange = confirmIconChange;
