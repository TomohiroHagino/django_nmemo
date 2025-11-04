// DOMヘルパーと公開関数
import { attachDragDropToPageItem, initPageTreeDragDrop } from './dnd.js';

export function moveDomAsChild(draggedId, parentId) {
    const draggedHeader = document.getElementById('header-' + draggedId);
    const parentHeader = document.getElementById('header-' + parentId);
    if (!draggedHeader || !parentHeader) return;

    const draggedItem = draggedHeader.closest('.page-item');
    const parentItem = parentHeader.closest('.page-item');
    if (!draggedItem || !parentItem) return;

    let children = document.getElementById('children-' + parentId);
    if (!children) {
        const toggleBtn = parentHeader.querySelector('.page-item__toggle');
        if (toggleBtn) {
            toggleBtn.id = 'toggle-' + parentId;
            toggleBtn.classList.remove('empty');
            toggleBtn.classList.add('collapsed');
            toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
        }
        children = document.createElement('div');
        children.id = 'children-' + parentId;
        children.className = 'page-item__children';
        parentItem.appendChild(children);
    }
    children.appendChild(draggedItem);
    children.classList.add('page-item__children--expanded');
    const t = document.getElementById('toggle-' + parentId);
    if (t) t.classList.remove('collapsed');
}

export function moveDomBeforeAfter(draggedId, targetId, position) {
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
}

export function toggleChildren(pageId) {
    const children = document.getElementById('children-' + pageId);
    const toggleBtn = document.getElementById('toggle-' + pageId);
    if (!children) return;

    if (children.classList.contains('page-item__children--expanded')) {
        children.classList.remove('page-item__children--expanded');
        if (toggleBtn) toggleBtn.classList.add('collapsed');
    } else {
        children.classList.add('page-item__children--expanded');
        if (toggleBtn) toggleBtn.classList.remove('collapsed');
    }
}

export function addPageToTree(pageId, title, parentId, escapeHtml) {
    const pageItemHtml = `
        <div class="page-item">
            <div class="page-item__header" id="header-${pageId}">
                <button class="page-item__toggle empty">▼</button>
                <span class="page-item__icon" onclick="event.stopPropagation(); openIconModal(${pageId}, '📄')" title="アイコンを変更">📄</span>
                <span class="page-item__title" onclick="loadPage(${pageId})" style="flex: 1;">
                    ${escapeHtml(title)}
                </span>
                <div class="actions">
                    <button class="btn" style="background: transparent; color: #37352f; font-size: 16px; padding: 4px 6px; border: none; cursor: pointer; font-weight: bold;" onclick="event.stopPropagation(); openCreateChildModal(${pageId}, '${escapeHtml(title).replace(/'/g, "\\'")}');" title="子ページを追加">+</button>
                </div>
            </div>
        </div>
    `;

    if (parentId) {
        let children = document.getElementById('children-' + parentId);
        if (!children) {
            const parentHeader = document.getElementById('header-' + parentId);
            const parentItem = parentHeader && parentHeader.parentElement;

            const toggleBtn = parentHeader && parentHeader.querySelector('.page-item__toggle');
            if (toggleBtn) {
                toggleBtn.id = 'toggle-' + parentId;
                toggleBtn.classList.remove('empty');
                toggleBtn.classList.add('collapsed');
                toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
            }

            children = document.createElement('div');
            children.id = 'children-' + parentId;
            children.className = 'page-item__children';
            if (parentItem) parentItem.appendChild(children);
        }

        children.insertAdjacentHTML('beforeend', pageItemHtml);
        const newHeader = document.getElementById('header-' + pageId);
        attachDragDropToPageItem(newHeader);
        children.classList.add('page-item__children--expanded');
        const t = document.getElementById('toggle-' + parentId);
        if (t) t.classList.remove('collapsed');
    } else {
        const tree = document.getElementById('pageTree');
        if (tree) {
            tree.insertAdjacentHTML('beforeend', pageItemHtml);
            const newHeader = document.getElementById('header-' + pageId);
            attachDragDropToPageItem(newHeader);
        } else {
            const sc = document.querySelector('.sidebar__content');
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