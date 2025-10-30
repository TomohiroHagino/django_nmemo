// D&D本体と初期化
import { movePageApi, reorderPageApi } from '../../api/pages.js';
import { moveDomAsChild, moveDomBeforeAfter } from './dom.js';

let draggedPageId = null;
let dropIndicator = null;

function pageTree() { return document.getElementById('pageTree'); }
function sidebar() { return document.querySelector('.sidebar'); }
function sidebarContent() { return document.querySelector('.sidebar-content'); }

function ensureDropIndicator() {
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        dropIndicator.style.display = 'none';
    }
    const sc = sidebarContent();
    if (sc && !dropIndicator.parentNode) sc.appendChild(dropIndicator);
    return dropIndicator;
}
function hideIndicator() {
    if (dropIndicator) dropIndicator.style.display = 'none';
}
function showIndicatorForRect(rect, position) {
    const sc = sidebarContent();
    if (!sc || !rect) return;
    const indicator = ensureDropIndicator();
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
    indicator.style.top = (position === 'before')
        ? (rect.top - scRect.top + scrollTop) + 'px'
        : (rect.bottom - scRect.top + scrollTop) + 'px';
}
function computePositionByPointer(e, el) {
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.2) return { position: 'before', rect };
    if (y < h * 0.8) return { position: 'child', rect };
    return { position: 'after', rect };
}
function clearDropClasses(el) {
    el.classList.remove('drop-target', 'drop-target-child', 'drop-target-before', 'drop-target-after');
    el.removeAttribute('data-drop-position');
}
function applyDropClass(el, position) {
    el.classList.remove('drop-target');
    if (position === 'child') {
        el.classList.add('drop-target', 'drop-target-child');
    } else if (position === 'before') {
        el.classList.add('drop-target-before');
    } else {
        el.classList.add('drop-target-after');
    }
    el.setAttribute('data-drop-position', position);
}
function isDescendant(targetId, ancestorId) {
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
}

// 公開: 初期化
export function initPageTreeDragDrop() {
    const tree = pageTree();
    if (!tree) return;

    attachDragDropToPageItems();

    const sc = sidebarContent();
    const sb = sidebar();
    if (!(sb && sc)) return;

    sb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    sc.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedPageId && (e.target === sc || e.target.classList.contains('sidebar-content') || e.target.id === 'pageTree' || e.target.classList.contains('page-list'))) {
            const tree = pageTree();
            if (tree) {
                const indicator = ensureDropIndicator();
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
                    if (draggedItem && pageTree()) pageTree().appendChild(draggedItem);
                }
                movePageApi(draggedPageId, null).catch(err => {
                    console.error('Error moving page:', err);
                    alert('移動に失敗しました');
                });
            }
        }
    });
}

// 公開: 既存ヘッダにD&D付与
export function attachDragDropToPageItems() {
    document.querySelectorAll('.page-item-header').forEach((header) => {
        attachDragDropToPageItem(header);
    });
}

// 公開: 個別ヘッダにD&D付与
export function attachDragDropToPageItem(header) {
    if (!header || header.dataset.dndAttached === '1') return;

    header.setAttribute('draggable', 'true');
    header.dataset.dndAttached = '1';

    header.addEventListener('dragstart', (e) => {
        const el = e.currentTarget;
        draggedPageId = el.id.replace('header-', '');
        el.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', el.innerHTML);
        ensureDropIndicator();
    });

    header.addEventListener('dragend', (e) => {
        e.currentTarget.style.opacity = '1';
        document.querySelectorAll('.page-item-header').forEach((h) => clearDropClasses(h));
        hideIndicator();
        if (dropIndicator && dropIndicator.parentNode) {
            dropIndicator.parentNode.removeChild(dropIndicator);
        }
        draggedPageId = null;
    });

    header.addEventListener('dragover', (e) => {
        e.preventDefault();

        const targetId = e.currentTarget.id.replace('header-', '');
        if (targetId === draggedPageId) return;

        const { position, rect } = computePositionByPointer(e, e.currentTarget);
        applyDropClass(e.currentTarget, position);
        showIndicatorForRect(rect, position);

        e.dataTransfer.dropEffect = 'move';
        return false;
    });

    header.addEventListener('dragenter', (e) => {
        const targetId = e.currentTarget.id.replace('header-', '');
        if (targetId === draggedPageId) return;

        const position = e.currentTarget.getAttribute('data-drop-position') || 'after';
        applyDropClass(e.currentTarget, position);
    });

    header.addEventListener('dragleave', (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) clearDropClasses(e.currentTarget);
    });

    header.addEventListener('drop', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const targetId = e.currentTarget.id.replace('header-', '');
        const position = e.currentTarget.getAttribute('data-drop-position') || 'after';
        if (targetId === draggedPageId) return;

        if (isDescendant(targetId, draggedPageId)) {
            alert('子孫ページを親にはできません');
            e.currentTarget.classList.remove('drop-target');
            return;
        }

        if (position === 'child') {
            moveDomAsChild(draggedPageId, targetId);
            movePageApi(draggedPageId, targetId).catch(err => {
                console.error('Error moving page:', err);
                alert('移動に失敗しました');
            });
            clearDropClasses(e.currentTarget);
            return false;
        }

        moveDomBeforeAfter(draggedPageId, targetId, position);
        reorderPageApi(draggedPageId, targetId, position).catch(err => {
            console.error('Error reordering page:', err);
            alert('並び替えに失敗しました');
        });
        clearDropClasses(e.currentTarget);
        return false;
    });
}