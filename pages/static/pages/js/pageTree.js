// ページツリーの管理とドラッグ＆ドロップ機能

let draggedPageId = null;
let draggedElement = null;
let dropIndicator = null;

// ページツリーのドラッグ＆ドロップ初期化
export function initPageTreeDragDrop() {
    const pageTree = document.getElementById('pageTree');
    if (!pageTree) return;
    
    // すべてのページ項目にドラッグ＆ドロップを付与
    attachDragDropToPageItems();
    
    // サイドバー上にドロップしてルートへ移動できるようにする
    const sidebar = document.querySelector('.sidebar');
    const sidebarContent = document.querySelector('.sidebar-content');
    
    if (sidebar && sidebarContent) {
        // dragover を許可し、既定動作を抑制しつつ視覚的フィードバックを出す
        sidebar.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        sidebarContent.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // 何もない領域の上にドラッグ中は控えめな視覚的フィードバックを付与
            if (draggedPageId && (e.target === sidebarContent || 
                e.target.classList.contains('sidebar-content') || 
                e.target.id === 'pageTree' || 
                e.target.classList.contains('page-list'))) {
                // 背景色変更の代わりに、ドロップインジケーターを表示
                if (dropIndicator && !dropIndicator.parentNode) {
                    const pageTree = document.getElementById('pageTree');
                    if (pageTree) {
                        pageTree.appendChild(dropIndicator);
                        dropIndicator.style.display = 'block';
                        dropIndicator.style.top = '0px';
                        dropIndicator.style.left = '10px';
                        dropIndicator.style.right = '10px';
                    }
                }
            }
        });
        
        sidebarContent.addEventListener('dragleave', function(e) {
            // 対象領域から離れたらフィードバックを除去
            if (!sidebarContent.contains(e.relatedTarget) || 
                (e.relatedTarget && e.relatedTarget.classList.contains('page-item-header'))) {
                if (dropIndicator && dropIndicator.parentNode && 
                    (e.relatedTarget && e.relatedTarget.classList.contains('page-item-header'))) {
                    dropIndicator.style.display = 'none';
                }
            }
        });
        
        // サイドバー領域へのドロップでルート直下へ移動させる
        sidebarContent.addEventListener('drop', function(e) {
            // ドロップインジケーターを非表示
            if (dropIndicator) {
                dropIndicator.style.display = 'none';
            }
            
            // ページ項目そのものではなく、サイドバー領域に落としたときだけ処理
            if (e.target === sidebarContent || e.target.classList.contains('sidebar-content') || 
                e.target.id === 'pageTree' || e.target.classList.contains('page-list')) {
                e.preventDefault();
                e.stopPropagation();
                
                // ルートへ移動（parent_id = null）
                if (draggedPageId) {
                    movePage(draggedPageId, null);
                }
            }
        });
    }
}

function attachDragDropToPageItems() {
    const pageItems = document.querySelectorAll('.page-item-header');
    
    pageItems.forEach(header => {
        // ドラッグ可能にする
        header.setAttribute('draggable', 'true');
        
        // ドラッグ関連イベント
        header.addEventListener('dragstart', handleDragStart);
        header.addEventListener('dragend', handleDragEnd);
        
        // ドロップ関連イベント
        header.addEventListener('dragover', handleDragOver);
        header.addEventListener('dragenter', handleDragEnter);
        header.addEventListener('dragleave', handleDragLeave);
        header.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    const pageId = draggedElement.id.replace('header-', '');
    draggedPageId = pageId;
    
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    
    // ドロップ位置インジケータを作成（スタイルはCSSで定義）
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        dropIndicator.style.display = 'none';
    }
}

function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    
    // すべての drop-target クラスを除去
    document.querySelectorAll('.page-item-header').forEach(header => {
        header.classList.remove('drop-target', 'drop-target-child', 'drop-target-before', 'drop-target-after');
        header.removeAttribute('data-drop-position');
    });
    
    // ドロップインジケーターを非表示（ルートドロップ用も含む）
    if (dropIndicator) {
        dropIndicator.style.display = 'none';
    }
    
    // ドロップ位置インジケータを除去
    if (dropIndicator && dropIndicator.parentNode) {
        dropIndicator.parentNode.removeChild(dropIndicator);
    }
    
    // ドラッグ中IDをリセット
    draggedPageId = null;
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    const targetPageId = e.currentTarget.id.replace('header-', '');
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // マウス位置から挿入位置を判定
    // 上部33%をbefore、中央34%をchild、下部33%をafterとする
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    let position;
    
    if (y < height * 0.2) {
        position = 'before';
    } else if (y < height * 0.8) {
        position = 'child';
    } else {
        position = 'after';
    }
    
    // 判定結果を要素の属性に保持
    e.currentTarget.setAttribute('data-drop-position', position);
    
    // child の場合は drop-target クラスを追加（青い背景）
    e.currentTarget.classList.remove('drop-target');
    if (position === 'child') {
        e.currentTarget.classList.add('drop-target');
    }
    
    // ドロップ位置インジケータを表示
    if (dropIndicator) {
        // 常にsidebar-contentを基準にする
        const sidebarContent = document.querySelector('.sidebar-content');
        
        if (!dropIndicator.parentNode && sidebarContent) {
            sidebarContent.appendChild(dropIndicator);
        }
        
        dropIndicator.style.display = 'block';
        
        const sidebarRect = sidebarContent.getBoundingClientRect();
        const scrollTop = sidebarContent.scrollTop || 0;
        
        // インジケーターの左右位置を現在のページアイテムに合わせる
        dropIndicator.style.left = (rect.left - sidebarRect.left) + 'px';
        dropIndicator.style.right = 'auto';
        dropIndicator.style.width = (rect.width) + 'px';
        
        if (position === 'before') {
            dropIndicator.style.top = (rect.top - sidebarRect.top + scrollTop) + 'px';
        } else if (position === 'after') {
            dropIndicator.style.top = (rect.bottom - sidebarRect.top + scrollTop) + 'px';
        } else {
            // child の場合は、ヘッダーの中央下部に表示
            dropIndicator.style.top = (rect.bottom - sidebarRect.top + scrollTop - 2) + 'px';
        }
    }
    
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    const targetPageId = e.currentTarget.id.replace('header-', '');
    
    // 自身へのドロップは不可
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // 位置に応じたクラスを追加
    const position = e.currentTarget.getAttribute('data-drop-position');
    if (position === 'child') {
        e.currentTarget.classList.add('drop-target-child');
    } else if (position === 'before') {
        e.currentTarget.classList.add('drop-target-before');
    } else {
        e.currentTarget.classList.add('drop-target-after');
    }
}

function handleDragLeave(e) {
    // 子要素に移動しただけでなく、実際に領域外へ出たときのみ除去
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drop-target', 'drop-target-child', 'drop-target-before', 'drop-target-after');
    }
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    
    const targetPageId = e.currentTarget.id.replace('header-', '');
    const position = e.currentTarget.getAttribute('data-drop-position') || 'after';
    
    // 自身へのドロップは不可
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // ドラッグ中のページの子孫を、親にすることは不可
    if (isDescendant(targetPageId, draggedPageId)) {
        alert('子孫ページを親にはできません');
        e.currentTarget.classList.remove('drop-target');
        return;
    }
    
    // position が 'child' の場合は、子階層に入れる
    if (position === 'child') {
        // サーバーに親変更を通知
        movePage(draggedPageId, targetPageId);
        
        e.currentTarget.classList.remove('drop-target');
        e.currentTarget.removeAttribute('data-drop-position');
        return false;
    }
    
    // DOMの見た目を即座に更新
    const draggedElement = document.getElementById('header-' + draggedPageId);
    const targetElement = document.getElementById('header-' + targetPageId);
    
    if (draggedElement && targetElement) {
        const draggedPageItem = draggedElement.closest('.page-item');
        const targetPageItem = targetElement.closest('.page-item');
        
        if (draggedPageItem && targetPageItem) {
            if (position === 'before') {
                targetPageItem.parentNode.insertBefore(draggedPageItem, targetPageItem);
            } else {
                // after の場合、次の兄弟要素の前に挿入、または末尾に追加
                if (targetPageItem.nextSibling) {
                    targetPageItem.parentNode.insertBefore(draggedPageItem, targetPageItem.nextSibling);
                } else {
                    targetPageItem.parentNode.appendChild(draggedPageItem);
                }
            }
        }
    }
    
    // サーバーに並び替えを通知
    reorderPage(draggedPageId, targetPageId, position);
    
    e.currentTarget.classList.remove('drop-target');
    e.currentTarget.removeAttribute('data-drop-position');
    return false;
}

function isDescendant(targetId, ancestorId) {
    // targetId が ancestorId の子孫かどうかを判定
    const targetElement = document.getElementById('header-' + targetId);
    if (!targetElement) return false;
    
    const targetItem = targetElement.closest('.page-item');
    let parent = targetItem.parentElement;
    
    while (parent) {
        if (parent.id === 'children-' + ancestorId) {
            return true;
        }
        
        // さらに上位の親へ辿る
        const parentItem = parent.closest('.page-item');
        if (!parentItem) break;
        
        parent = parentItem.parentElement;
        if (parent && parent.id === 'pageTree') break;
    }
    
    return false;
}

function movePage(pageId, newParentId) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    
    // newParentId が null/undefined の場合は空文字で送る
    if (newParentId === null || newParentId === undefined) {
        formData.append('new_parent_id', '');
    } else {
        formData.append('new_parent_id', newParentId);
    }
    
    fetch(`/page/${pageId}/move/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // ツリーを更新して反映
            window.location.reload();
        } else {
            alert('移動に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error moving page:', error);
        alert('移動に失敗しました');
    });
}

function reorderPage(pageId, targetPageId, position) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    formData.append('target_page_id', targetPageId);
    formData.append('position', position);
    
    fetch(`/page/${pageId}/reorder/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 何もしない（既にDOMが更新されている）
        } else {
            alert('並び替えに失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error reordering page:', error);
        alert('並び替えに失敗しました');
    });
}

export function toggleChildren(pageId) {
    const childrenElement = document.getElementById('children-' + pageId);
    const toggleBtn = document.getElementById('toggle-' + pageId);
    
    if (childrenElement) {
        if (childrenElement.classList.contains('expanded')) {
            childrenElement.classList.remove('expanded');
            toggleBtn.classList.add('collapsed');
        } else {
            childrenElement.classList.add('expanded');
            toggleBtn.classList.remove('collapsed');
        }
    }
}

export function addPageToTree(pageId, title, parentId, escapeHtml) {
    const now = new Date().toISOString();
    
    // 新しいページ項目のHTMLを生成
    const pageItemHtml = `
        <div class="page-item">
            <div class="page-item-header" id="header-${pageId}">
                <button class="toggle-btn empty">▼</button>
                <span class="page-icon" onclick="event.stopPropagation(); openIconModal(${pageId}, '📄')" title="アイコンを変更">📄</span>
                <span class="page-item-title" onclick="loadPage(${pageId})" style="flex: 1;">
                    ${escapeHtml(title)}
                </span>
                <div class="actions">
                    <button class="btn" style="background: transparent; color: #37352f; font-size: 16px; padding: 4px 6px; border: none; cursor: pointer; font-weight: bold;" onclick="event.stopPropagation(); openCreateChildModal(${pageId}, '${escapeHtml(title).replace(/'/g, "\\'")}');" title="子ページを追加">+</button>
                    <a href="/page/${pageId}/export/" class="btn" style="background: #28a745; color: white; text-decoration: none; font-size: 11px; padding: 4px 8px;" onclick="event.stopPropagation();" title="エクスポート">📥</a>
                </div>
            </div>
        </div>
    `;
    
    if (parentId) {
        // 親ページに子として追加
        let childrenContainer = document.getElementById('children-' + parentId);
        
        // 子コンテナが未作成なら生成
        if (!childrenContainer) {
            const parentHeader = document.getElementById('header-' + parentId);
            const parentItem = parentHeader.parentElement;
            
            // 親のトグルボタンを更新
            const toggleBtn = parentHeader.querySelector('.toggle-btn');
            toggleBtn.id = 'toggle-' + parentId;
            toggleBtn.classList.remove('empty');
            toggleBtn.classList.add('collapsed');
            toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
            
            // 子コンテナを作成
            childrenContainer = document.createElement('div');
            childrenContainer.id = 'children-' + parentId;
            childrenContainer.className = 'children';
            parentItem.appendChild(childrenContainer);
        }
        
        // 子コンテナの末尾に追加
        childrenContainer.insertAdjacentHTML('beforeend', pageItemHtml);
        
        // 追加が見えるように親を展開
        childrenContainer.classList.add('expanded');
        const toggleBtn = document.getElementById('toggle-' + parentId);
        if (toggleBtn) {
            toggleBtn.classList.remove('collapsed');
        }
    } else {
        // ルートページとして追加
        const pageTree = document.getElementById('pageTree');
        if (pageTree) {
            pageTree.insertAdjacentHTML('beforeend', pageItemHtml);
        } else {
            // ツリー自体が無ければ（空状態なら）作り直す
            const sidebarContent = document.querySelector('.sidebar-content');
            const emptyState = sidebarContent.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
            
            const newTree = document.createElement('div');
            newTree.className = 'page-list';
            newTree.id = 'pageTree';
            newTree.innerHTML = pageItemHtml;
            sidebarContent.appendChild(newTree);
        }
    }
}
