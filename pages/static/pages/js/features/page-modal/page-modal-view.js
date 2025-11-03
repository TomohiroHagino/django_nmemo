import { setCreateEditor, getCreateEditor, setTitleEnterPressed, resetState } from './page-modal-state.js';
import { focus } from '../../shared/quill/insert.js';

export { setCreateEditor }; // 公開

export function openCreateModal() {
    const modal = document.getElementById('createModal');
    if (!modal) {
        console.error('createModal not found');
        return;
    }
    
    const modalTitle = modal.querySelector('.modal__header h2');
    if (!modalTitle) {
        console.error('modal__header h2 not found in createModal');
        return;
    }
    
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = '新しいページを作成';
    if (parentIdInput) {
        parentIdInput.value = '';
    }
    modal.style.display = 'block';
    
    // クリーンアップ設定を有効化
    setupTempCleanupOnUnload();

    setTimeout(() => {
        const titleInput = document.getElementById('newPageTitle');
        if (!titleInput) return;
        titleInput.focus();
        setTitleEnterPressed(false);
        titleInput.addEventListener('keydown', function handle(e) {
            if (e.key === 'Enter' && document.activeElement === titleInput) {
                setTitleEnterPressed(true);
                e.preventDefault();
                e.stopPropagation();
                const q = getCreateEditor();
                if (q) focus(q);
                titleInput.removeEventListener('keydown', handle);
            }
        }, true);
    }, 100);
}

export function openCreateChildModal(parentId, parentTitle) {
    const modal = document.getElementById('createModal');
    if (!modal) {
        console.error('createModal not found');
        return;
    }
    
    const modalTitle = modal.querySelector('.modal__header h2');
    if (!modalTitle) {
        console.error('modal__header h2 not found in createModal');
        return;
    }
    
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = `「${parentTitle}」の子ページを作成`;
    if (parentIdInput) {
        parentIdInput.value = parentId;
    }
    modal.style.display = 'block';
    
    // クリーンアップ設定を有効化
    setupTempCleanupOnUnload();

    setTimeout(() => {
        const titleInput = document.getElementById('newPageTitle');
        if (!titleInput) return;
        titleInput.focus();
        setTitleEnterPressed(false);
        titleInput.addEventListener('keydown', function handle(e) {
            if (e.key === 'Enter' && document.activeElement === titleInput) {
                setTitleEnterPressed(true);
                e.preventDefault();
                e.stopPropagation();
                const q = getCreateEditor();
                if (q) focus(q);
                titleInput.removeEventListener('keydown', handle);
            }
        }, true);
    }, 100);
}

export function closeCreateModal() {
    const modal = document.getElementById('createModal');
    if (!modal) return;
    
    const modalContent = document.getElementById('modalContent');
    
    // エディタのコンテンツを取得して一時画像をクリーンアップ
    const q = getCreateEditor();
    let contentHtml = '';
    
    if (q) {
        // CustomEditorの場合はgetContent()を使用
        if (typeof q.getContent === 'function') {
            contentHtml = q.getContent();
        } 
        // Quill互換性のため
        else if (q.root) {
            contentHtml = q.root.innerHTML;
        }
        // エディタ要素が直接利用可能な場合
        else if (q.editor) {
            contentHtml = q.editor.innerHTML;
        }
    }
    
    // コンテンツが取得できた場合のみクリーンアップを実行
    if (contentHtml) {
        console.log('モーダルを閉じる前のコンテンツ:', contentHtml);
        // 一時画像のクリーンアップAPIを呼び出す（非同期だが待たない）
        cleanupTempImages(contentHtml).catch(err => {
            console.warn('一時画像のクリーンアップに失敗しました:', err);
        });
    } else {
        // コンテンツが空の場合は、すべての一時ファイルを削除する
        console.log('コンテンツが空のため、すべての一時ファイルを削除します');
        cleanupTempImages('').catch(err => {
            console.warn('一時画像のクリーンアップに失敗しました:', err);
        });
    }
    
    modal.style.display = 'none';
    
    const titleInput = document.getElementById('newPageTitle');
    if (titleInput) {
        titleInput.value = '';
    }
    
    resetState();
    if (q) { 
        if (q.setContents) {
            q.setContents([]);
        } else if (q.clear) {
            q.clear();
        }
    }
    
    if (modalContent) {
        modalContent.style.width = '600px';
        modalContent.style.height = '';
        modalContent.style.left = '50%';
        modalContent.style.top = '50%';
        modalContent.style.transform = 'translate(-50%, -50%)';
    }
}

// 一時画像をクリーンアップする関数
async function cleanupTempImages(contentHtml) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (!csrfToken) {
        console.warn('CSRFトークンが見つかりません');
        return;
    }
    
    // デバッグ: コンテンツをログ出力
    console.log('クリーンアップ対象のコンテンツ:', contentHtml);
    
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
        } else {
            console.error('一時画像のクリーンアップに失敗:', data.error);
        }
    } catch (error) {
        console.error('一時画像のクリーンアップエラー:', error);
    }
}

// ページロード時にbeforeunloadイベントを設定
let tempCleanupSetup = false;

export function setupTempCleanupOnUnload() {
    if (tempCleanupSetup) return;
    tempCleanupSetup = true;
    
    window.addEventListener('beforeunload', () => {
        // モーダルが開いている場合のみクリーンアップを試みる
        const modal = document.getElementById('createModal');
        if (modal && modal.style.display === 'block') {
            const q = getCreateEditor();
            if (q) {
                let contentHtml = '';
                if (q.getContent) {
                    contentHtml = q.getContent();
                } else if (q.root) {
                    contentHtml = q.root.innerHTML;
                }
                
                // 同期的にクリーンアップを試みる（ただし確実ではない）
                if (contentHtml) {
                    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
                    if (csrfToken) {
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
        }
    });
}