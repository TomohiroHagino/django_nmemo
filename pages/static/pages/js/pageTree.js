// ページツリーの管理とドラッグ＆ドロップ機能（リファクタ版）

let draggedPageId = null;
let dropIndicator = null;

const Dnd = {
    get pageTree() { return document.getElementById('pageTree'); },
    get sidebar() { return document.querySelector('.sidebar'); },
    get sidebarContent() { return document.querySelector('.sidebar-content'); },

    ensureDropIndicator() {
        if (!dropIndicator) {
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            dropIndicator.style.display = 'none';
        }
        if (this.sidebarContent && !dropIndicator.parentNode) {
            this.sidebarContent.appendChild(dropIndicator);
        }
        return dropIndicator;
    },

    hideIndicator() {
        if (dropIndicator) dropIndicator.style.display = 'none';
    },

    showIndicatorForRect(rect, position) {
        const sc = this.sidebarContent;
        if (!sc || !rect) return;

        const indicator = this.ensureDropIndicator();
        const scRect = sc.getBoundingClientRect();
        const scrollTop = sc.scrollTop || 0;

        if (position === 'child') {
            indicator.style.display = 'none';
            return;
        }

        indicator.style.display = 'block';
        indicator.style.left = (rect.left - scRect.left) + 'px';
        indicator.style.right = 'auto';
        indicator.style.width = rect.width + 'px';

        if (position === 'before') {
            indicator.style.top = (rect.top - scRect.top + scrollTop) + 'px';
        } else if (position === 'after') {
            indicator.style.top = (rect.bottom - scRect.top + scrollTop) + 'px';
        }
    },

    computePositionByPointer(e, targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const h = rect.height;
        if (y < h * 0.2) return { position: 'before', rect };
        if (y < h * 0.8) return { position: 'child', rect };
        return { position: 'after', rect };
    },

    clearDropClasses(el) {
        el.classList.remove('drop-target', 'drop-target-child', 'drop-target-before', 'drop-target-after');
        el.removeAttribute('data-drop-position');
    },

    applyDropClass(el, position) {
        el.classList.remove('drop-target');
        if (position === 'child') {
            el.classList.add('drop-target', 'drop-target-child');
        } else if (position === 'before') {
            el.classList.add('drop-target-before');
        } else {
            el.classList.add('drop-target-after');
        }
        el.setAttribute('data-drop-position', position);
    },

    isDescendant(targetId, ancestorId) {
        const targetHeader = document.getElementById('header-' + targetId);
        if (!targetHeader) return false;
        const targetItem = targetHeader.closest('.page-item');
        let parent = targetItem && targetItem.parentElement;

        while (parent) {
            if (parent.id === 'children-' + ancestorId) return true;
            const parentItem = parent.closest('.page-item');
            if (!parentItem) break;
            parent = parentItem.parentElement;
            if (parent && parent.id === 'pageTree') break;
        }
        return false;
    },

    // DOM 操作
    moveDomAsChild(draggedId, parentId) {
        const draggedHeader = document.getElementById('header-' + draggedId);
        const parentHeader = document.getElementById('header-' + parentId);
        if (!draggedHeader || !parentHeader) return;

        const draggedItem = draggedHeader.closest('.page-item');
        const parentItem = parentHeader.closest('.page-item');
        if (!draggedItem || !parentItem) return;

        let children = document.getElementById('children-' + parentId);
        if (!children) {
            const toggleBtn = parentHeader.querySelector('.toggle-btn');
            if (toggleBtn) {
                toggleBtn.id = 'toggle-' + parentId;
                toggleBtn.classList.remove('empty');
                toggleBtn.classList.add('collapsed');
                toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
            }
            children = document.createElement('div');
            children.id = 'children-' + parentId;
            children.className = 'children';
            parentItem.appendChild(children);
        }
        children.appendChild(draggedItem);
        children.classList.add('expanded');
        const t = document.getElementById('toggle-' + parentId);
        if (t) t.classList.remove('collapsed');
    },

    moveDomBeforeAfter(draggedId, targetId, position) {
        const draggedHeader = document.getElementById('header-' + draggedId);
        const targetHeader = document.getElementById('header-' + targetId);
        if (!draggedHeader || !targetHeader) return;

        const draggedItem = draggedHeader.closest('.page-item');
        const targetItem = targetHeader.closest('.page-item');
        if (!draggedItem || !targetItem) return;

        if (position === 'before') {
            targetItem.parentNode.insertBefore(draggedItem, targetItem);
        } else {
            if (targetItem.nextSibling) {
                targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
            } else {
                targetItem.parentNode.appendChild(draggedItem);
            }
        }
    },

    // サーバ通信
    movePage(pageId, newParentId) {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        const formData = new FormData();
        formData.append('new_parent_id', newParentId == null ? '' : newParentId);

        fetch(`/page/${pageId}/move/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken, 'X-Requested-With': 'XMLHttpRequest' },
            body: formData
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                attachDragDropToPageItems();
            } else {
                alert('移動に失敗しました: ' + (data.error || '不明なエラー'));
            }
        })
        .catch(err => {
            console.error('Error moving page:', err);
            alert('移動に失敗しました');
        });
    },

    reorderPage(pageId, targetPageId, position) {
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        const formData = new FormData();
        formData.append('target_page_id', targetPageId);
        formData.append('position', position);

        fetch(`/page/${pageId}/reorder/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken, 'X-Requested-With': 'XMLHttpRequest' },
            body: formData
        })
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                alert('並び替えに失敗しました: ' + (data.error || '不明なエラー'));
            }
        })
        .catch(err => {
            console.error('Error reordering page:', err);
            alert('並び替えに失敗しました');
        });
    }
};

// 初期化
export function initPageTreeDragDrop() {
    const pageTree = Dnd.pageTree;
    if (!pageTree) return;

    attachDragDropToPageItems();

    const sc = Dnd.sidebarContent;
    const sb = Dnd.sidebar;
    if (!(sb && sc)) return;

    sb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    sc.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedPageId && (e.target === sc || e.target.classList.contains('sidebar-content') || e.target.id === 'pageTree' || e.target.classList.contains('page-list'))) {
            const tree = Dnd.pageTree;
            if (tree) {
                const indicator = Dnd.ensureDropIndicator();
                if (!indicator.parentNode) tree.appendChild(indicator);
                indicator.style.display = 'block';
                indicator.style.top = '0px';
                indicator.style.left = '10px';
                indicator.style.right = '10px';
            }
        }
    });

    sc.addEventListener('dragleave', (e) => {
        if (!sc.contains(e.relatedTarget) || (e.relatedTarget && e.relatedTarget.classList.contains('page-item-header'))) {
            if (dropIndicator && dropIndicator.parentNode && (e.relatedTarget && e.relatedTarget.classList.contains('page-item-header'))) {
                dropIndicator.style.display = 'none';
            }
        }
    });

    sc.addEventListener('drop', (e) => {
        if (dropIndicator) dropIndicator.style.display = 'none';

        if (e.target === sc || e.target.classList.contains('sidebar-content') || e.target.id === 'pageTree' || e.target.classList.contains('page-list')) {
            e.preventDefault();
            e.stopPropagation();

            if (draggedPageId) {
                const draggedHeader = document.getElementById('header-' + draggedPageId);
                if (draggedHeader) {
                    const draggedItem = draggedHeader.closest('.page-item');
                    if (draggedItem && Dnd.pageTree) {
                        Dnd.pageTree.appendChild(draggedItem);
                    }
                }
                Dnd.movePage(draggedPageId, null);
            }
        }
    });
}

// 既存の全ヘッダにD&D付与
function attachDragDropToPageItems() {
    document.querySelectorAll('.page-item-header').forEach((header) => {
        attachDragDropToPageItem(header);
    });
}

// 個別ヘッダにD&D付与（重複防止）
function attachDragDropToPageItem(header) {
    if (!header || header.dataset.dndAttached === '1') return;

    header.setAttribute('draggable', 'true');
    header.dataset.dndAttached = '1';

    header.addEventListener('dragstart', (e) => {
        const el = e.currentTarget;
        draggedPageId = el.id.replace('header-', '');
        el.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', el.innerHTML);
        Dnd.ensureDropIndicator();
    });

    header.addEventListener('dragend', (e) => {
        e.currentTarget.style.opacity = '1';
        document.querySelectorAll('.page-item-header').forEach((h) => {
            Dnd.clearDropClasses(h);
        });
        Dnd.hideIndicator();
        if (dropIndicator && dropIndicator.parentNode) {
            dropIndicator.parentNode.removeChild(dropIndicator);
        }
        draggedPageId = null;
    });

    header.addEventListener('dragover', (e) => {
        e.preventDefault();

        const targetId = e.currentTarget.id.replace('header-', '');
        if (targetId === draggedPageId) return;

        const { position, rect } = Dnd.computePositionByPointer(e, e.currentTarget);
        Dnd.applyDropClass(e.currentTarget, position);
        Dnd.showIndicatorForRect(rect, position);

        e.dataTransfer.dropEffect = 'move';
        return false;
    });

    header.addEventListener('dragenter', (e) => {
        const targetId = e.currentTarget.id.replace('header-', '');
        if (targetId === draggedPageId) return;

        const position = e.currentTarget.getAttribute('data-drop-position');
        Dnd.applyDropClass(e.currentTarget, position || 'after');
    });

    header.addEventListener('dragleave', (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            Dnd.clearDropClasses(e.currentTarget);
        }
    });

    header.addEventListener('drop', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const targetId = e.currentTarget.id.replace('header-', '');
        const position = e.currentTarget.getAttribute('data-drop-position') || 'after';

        if (targetId === draggedPageId) return;

        if (Dnd.isDescendant(targetId, draggedPageId)) {
            alert('子孫ページを親にはできません');
            e.currentTarget.classList.remove('drop-target');
            return;
        }

        if (position === 'child') {
            Dnd.moveDomAsChild(draggedPageId, targetId);
            Dnd.movePage(draggedPageId, targetId);
            Dnd.clearDropClasses(e.currentTarget);
            return false;
        }

        Dnd.moveDomBeforeAfter(draggedPageId, targetId, position);
        Dnd.reorderPage(draggedPageId, targetId, position);

        Dnd.clearDropClasses(e.currentTarget);
        return false;
    });
}

export function toggleChildren(pageId) {
    const children = document.getElementById('children-' + pageId);
    const toggleBtn = document.getElementById('toggle-' + pageId);
    if (!children) return;

    if (children.classList.contains('expanded')) {
        children.classList.remove('expanded');
        if (toggleBtn) toggleBtn.classList.add('collapsed');
    } else {
        children.classList.add('expanded');
        if (toggleBtn) toggleBtn.classList.remove('collapsed');
    }
}

export function addPageToTree(pageId, title, parentId, escapeHtml) {
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
        let children = document.getElementById('children-' + parentId);
        if (!children) {
            const parentHeader = document.getElementById('header-' + parentId);
            const parentItem = parentHeader && parentHeader.parentElement;

            const toggleBtn = parentHeader && parentHeader.querySelector('.toggle-btn');
            if (toggleBtn) {
                toggleBtn.id = 'toggle-' + parentId;
                toggleBtn.classList.remove('empty');
                toggleBtn.classList.add('collapsed');
                toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
            }

            children = document.createElement('div');
            children.id = 'children-' + parentId;
            children.className = 'children';
            if (parentItem) parentItem.appendChild(children);
        }

        children.insertAdjacentHTML('beforeend', pageItemHtml);

        const newHeader = document.getElementById('header-' + pageId);
        attachDragDropToPageItem(newHeader);

        children.classList.add('expanded');
        const t = document.getElementById('toggle-' + parentId);
        if (t) t.classList.remove('collapsed');
    } else {
        const tree = Dnd.pageTree;
        if (tree) {
            tree.insertAdjacentHTML('beforeend', pageItemHtml);
            const newHeader = document.getElementById('header-' + pageId);
            attachDragDropToPageItem(newHeader);
        } else {
            const sc = Dnd.sidebarContent;
            const emptyState = sc && sc.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            const newTree = document.createElement('div');
            newTree.className = 'page-list';
            newTree.id = 'pageTree';
            newTree.innerHTML = pageItemHtml;
            if (sc) sc.appendChild(newTree);

            const newHeader = document.getElementById('header-' + pageId);
            attachDragDropToPageItem(newHeader);

            initPageTreeDragDrop();
            return;
        }
    }
}
