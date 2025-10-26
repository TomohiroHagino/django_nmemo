// Page CRUD operations

let currentPageId = null;
let saveTimeout = null;
let originalTitle = '';
let originalContent = '';

export function getCurrentPageId() {
    return currentPageId;
}

export function loadPage(pageId, initContentEditor, escapeHtml, formatDate) {
    // Remove active class from all items
    document.querySelectorAll('.page-item-header').forEach(el => {
        el.classList.remove('active');
    });
    
    // Add active class to clicked item
    const header = document.getElementById('header-' + pageId);
    if (header) {
        header.classList.add('active');
    }
    
    currentPageId = pageId;
    
    // Fetch page content and return the promise
    return fetch(`/api/page/${pageId}/`)
        .then(response => response.json())
        .then(data => {
            originalTitle = data.title;
            originalContent = data.content;
            
            const contentArea = document.getElementById('pageContent');
            contentArea.innerHTML = `
                <div style="max-width: 900px; margin: 0 auto;">
                    <h1 class="page-title-main" contenteditable="true" id="pageTitle">${escapeHtml(data.title)}</h1>
                    <div class="page-meta">
                        <span>作成: ${formatDate(data.created_at)}</span>
                        <span>更新: ${formatDate(data.updated_at)}</span>
                    </div>
                    <div id="contentEditor"></div>
                    <div class="edit-buttons">
                        <button onclick="savePage()" class="btn btn-primary">💾 保存</button>
                        <button onclick="cancelEdit()" class="btn" style="background: #6c757d; color: white;">キャンセル</button>
                        <a href="/page/${pageId}/export/" class="btn btn-success" title="JSONファイルとしてエクスポート">📥 JSON</a>
                        <button onclick="deletePage(${pageId})" class="btn btn-danger">🗑️ 削除</button>
                    </div>
                </div>
            `;
            
            // Initialize Quill editor for content
            const contentQuill = initContentEditor(data.content);
            
            // Add input listeners for auto-save indication
            const titleEl = document.getElementById('pageTitle');
            
            if (titleEl) {
                titleEl.addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        // Auto-save after 2 seconds of inactivity
                        // savePage();
                    }, 2000);
                });
                
                // Prevent line breaks in title
                titleEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (contentQuill) {
                            contentQuill.focus();
                        }
                    }
                });
            }
            
            return contentQuill;
        })
        .catch(error => {
            console.error('Error loading page:', error);
            const contentArea = document.getElementById('pageContent');
            contentArea.innerHTML = '<div class="content-empty">ページの読み込みに失敗しました</div>';
            return null;
        });
}

export function savePage(contentQuill, showSaveIndicator) {
    if (!currentPageId) return;
    
    const titleEl = document.getElementById('pageTitle');
    
    if (!titleEl || !contentQuill) return;
    
    const title = titleEl.textContent.trim();
    const content = contentQuill.root.innerHTML;
    
    if (!title) {
        alert('タイトルは必須です');
        return;
    }
    
    // Get CSRF token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    // Show saving indicator
    showSaveIndicator('保存中...');
    
    // Send update request
    fetch(`/page/${currentPageId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
            'title': title,
            'content': content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSaveIndicator('保存しました ✓');
            originalTitle = title;
            originalContent = content;
            
            // Update tree item title
            const treeTitle = document.querySelector(`#header-${currentPageId} .page-item-title`);
            if (treeTitle) {
                treeTitle.textContent = title;
            }
        } else {
            alert('保存に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error saving page:', error);
        alert('保存に失敗しました');
    });
}

export function cancelEdit(contentQuill) {
    const titleEl = document.getElementById('pageTitle');
    
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
    
    fetch(`/page/${pageId}/delete/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remove from tree
            const pageHeader = document.getElementById('header-' + pageId);
            if (pageHeader) {
                const pageItem = pageHeader.parentElement;
                pageItem.remove();
            }
            
            // Clear content area
            const contentArea = document.getElementById('pageContent');
            contentArea.innerHTML = '<div class="content-empty">← 左側のページを選択してください</div>';
            currentPageId = null;
            
            showSaveIndicator('ページを削除しました ✓');
        } else {
            alert('削除に失敗しました');
        }
    })
    .catch(error => {
        console.error('Error deleting page:', error);
        alert('削除に失敗しました');
    });
}

