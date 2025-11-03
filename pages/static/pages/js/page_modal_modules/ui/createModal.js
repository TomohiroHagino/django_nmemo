import { createPageFlow } from '../services/pageService.js';

let createQuill = null;
let titleInputEnterPressed = false;

export function setCreateQuill(quill) { createQuill = quill; }

export function openCreateModal() {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal__header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');

    modalTitle.textContent = '新しいページを作成';
    parentIdInput.value = '';
    modal.style.display = 'block';
    
    // クリーンアップ設定を有効化
    setupTempCleanupOnUnload();

    setTimeout(() => {
        const titleInput = document.getElementById('newPageTitle');
        if (!titleInput) return;
        titleInput.focus();
        titleInputEnterPressed = false;
        titleInput.addEventListener('keydown', function handleTitleEnter(e) {
            if (e.key === 'Enter' && document.activeElement === titleInput) {
                titleInputEnterPressed = true;
                e.preventDefault();
                e.stopPropagation();
                if (createQuill) { createQuill.focus(); }
                titleInput.removeEventListener('keydown', handleTitleEnter);
            }
        }, true);
    }, 100);
}

export function openCreateChildModal(parentId, parentTitle) {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal__header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = `「${parentTitle}」の子ページを作成`;
    parentIdInput.value = parentId;
    modal.style.display = 'block';
}

export function closeCreateModal() {
    const modal = document.getElementById('createModal');
    const modalContent = document.getElementById('modalContent');
    
    // エディタのコンテンツを取得
    let contentHtml = '';
    if (createQuill) {
        // CustomEditorの場合はgetContent()を使用
        if (createQuill.getContent) {
            contentHtml = createQuill.getContent();
        } else if (createQuill.root) {
            // Quill互換性のため
            contentHtml = createQuill.root.innerHTML;
        }
        
        // 一時画像のクリーンアップAPIを呼び出す（非同期だが待たない）
        cleanupTempImages(contentHtml).catch(err => {
            console.warn('一時画像のクリーンアップに失敗しました:', err);
        });
    }
    
    modal.style.display = 'none';
    document.getElementById('newPageTitle').value = '';
    titleInputEnterPressed = false;
    if (createQuill) { 
        if (createQuill.setContents) {
            createQuill.setContents([]);
        } else if (createQuill.clear) {
            createQuill.clear();
        }
    }
    modalContent.style.width = '600px';
    modalContent.style.height = '';
    modalContent.style.left = '50%';
    modalContent.style.top = '50%';
    modalContent.style.transform = 'translate(-50%, -50%)';
}

// 一時画像をクリーンアップする関数
async function cleanupTempImages(contentHtml) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (!csrfToken) {
        return;
    }
    
    try {
        const response = await fetch('/api/cleanup-temp-images/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ content: contentHtml }),
            // keepalive: true でブラウザを閉じた時でも送信を試みる
            keepalive: true
        });
        
        const data = await response.json();
        if (data.success) {
            console.log(`一時画像${data.deleted_count}件を削除しました`);
        }
    } catch (error) {
        console.error('一時画像のクリーンアップエラー:', error);
    }
}

export async function handleCreatePage(event, addPageToTree, escapeHtml) {
    if (titleInputEnterPressed) {
        event.preventDefault();
        titleInputEnterPressed = false;
        return false;
    }
    event.preventDefault();

    if (createQuill) {
        const content = createQuill.root.innerHTML;
        document.getElementById('newPageContent').value = content;
    }

    const form = event.target;
    const formData = new FormData(form);
    const parentId = formData.get('parent_id') || '';
    const title = document.getElementById('newPageTitle').value;
    const contentHtml = document.getElementById('newPageContent').value;

    try {
        const { pageId } = await createPageFlow({ parentId, title, contentHtml });
        closeCreateModal();
        addPageToTree(pageId, title, parentId, escapeHtml);
    } catch (e) {
        alert('エラー: ' + (e.message || '不明なエラー'));
    }
    return false;
}

export function getCreateEditor() { return createQuill; }

// ページロード時にbeforeunloadイベントを設定
let tempCleanupSetup = false;

export function setupTempCleanupOnUnload() {
    if (tempCleanupSetup) return;
    tempCleanupSetup = true;
    
    window.addEventListener('beforeunload', () => {
        // モーダルが開いている場合のみクリーンアップを試みる
        const modal = document.getElementById('createModal');
        if (modal && modal.style.display === 'block' && createQuill) {
            let contentHtml = '';
            if (createQuill.getContent) {
                contentHtml = createQuill.getContent();
            } else if (createQuill.root) {
                contentHtml = createQuill.root.innerHTML;
            }
            
            // 同期的にクリーンアップを試みる（ただし確実ではない）
            if (contentHtml) {
                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
                if (csrfToken) {
                    // navigator.sendBeacon を使用して確実に送信を試みる
                    try {
                        const blob = new Blob(
                            [JSON.stringify({ content: contentHtml })],
                            { type: 'application/json' }
                        );
                        // fetch with keepalive は sendBeacon の代替
                        fetch('/api/cleanup-temp-images/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrfToken
                            },
                            body: blob,
                            keepalive: true
                        }).catch(() => {
                            // エラーは無視（ブラウザを閉じる途中なので）
                        });
                    } catch (e) {
                        // エラーは無視
                    }
                }
            }
        }
    });
}