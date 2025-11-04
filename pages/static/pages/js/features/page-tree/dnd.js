// pages/static/pages/js/features/page-tree/dnd.js
//
// ページツリーのドラッグ&ドロップ機能を管理するモジュール
//
// 【使い方のルール】
// - ページツリーの初期化時に`initPageTreeDragDrop()`を呼び出してください
// - 動的に追加されたページヘッダーには`attachDragDropToPageItem()`を使用してください
// - 既存のすべてのページヘッダーにD&Dを付与する場合は`attachDragDropToPageItems()`を使用してください
//
// 【使用例】
//   import { initPageTreeDragDrop, attachDragDropToPageItem } from './page-tree/dnd.js';
//
//   // ページツリーの初期化（通常はアプリケーション起動時に1回のみ）
//   initPageTreeDragDrop();
//
//   // 新しく追加されたページヘッダーにD&D機能を付与
//   const newHeader = document.getElementById('header-123');
//   attachDragDropToPageItem(newHeader);
//
// 【ドラッグ&ドロップの動作】
// - ページヘッダーをドラッグすることで、ページの位置を変更できます
// - ドロップ位置は以下の3種類があります：
//   - 'before': ターゲットページの前に配置
//   - 'after': ターゲットページの後に配置
//   - 'child': ターゲットページの子として配置
// - 子孫ページを親にすることはできません（エラーが表示されます）

import { movePageApi, reorderPageApi } from '../../api/pages.js';
import { moveDomAsChild, moveDomBeforeAfter } from './dom.js';

// 現在ドラッグ中のページID
let draggedPageId = null;

// ドロップ位置を示すインジケーター要素
let dropIndicator = null;

// 内部関数: ページツリー要素を取得
function pageTree() { return document.getElementById('pageTree'); }

// 内部関数: サイドバー要素を取得
function sidebar() { return document.querySelector('.sidebar'); }

// 内部関数: サイドバーコンテンツ要素を取得
function sidebarContent() { return document.querySelector('.sidebar__content'); }

// 内部関数: ドロップインジケーター要素を確保（存在しない場合は作成）
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

// 内部関数: ドロップインジケーターを非表示にする
function hideIndicator() {
    if (dropIndicator) dropIndicator.style.display = 'none';
}

// 内部関数: 指定された位置にドロップインジケーターを表示
// @param {DOMRect} rect - ターゲット要素の位置情報
// @param {string} position - ドロップ位置 ('before', 'after', 'child')
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

// 内部関数: マウスポインターの位置からドロップ位置を計算
// @param {DragEvent} e - ドラッグイベント
// @param {HTMLElement} el - ターゲット要素
// @returns {{position: string, rect: DOMRect}} ドロップ位置と要素の位置情報
function computePositionByPointer(e, el) {
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.2) return { position: 'before', rect };
    if (y < h * 0.8) return { position: 'child', rect };
    return { position: 'after', rect };
}

// 内部関数: ドロップ関連のCSSクラスをすべて削除
// @param {HTMLElement} el - 対象要素
function clearDropClasses(el) {
    el.classList.remove('page-item__header--drop-target', 'page-item__header--drop-target-child', 'page-item__header--drop-target-before', 'page-item__header--drop-target-after');
    el.removeAttribute('data-drop-position');
}

// 内部関数: ドロップ位置に応じたCSSクラスを適用
// @param {HTMLElement} el - 対象要素
// @param {string} position - ドロップ位置 ('before', 'after', 'child')
function applyDropClass(el, position) {
    el.classList.remove('page-item__header--drop-target');
    if (position === 'child') {
        el.classList.add('page-item__header--drop-target', 'page-item__header--drop-target-child');
    } else if (position === 'before') {
        el.classList.add('page-item__header--drop-target-before');
    } else {
        el.classList.add('page-item__header--drop-target-after');
    }
    el.setAttribute('data-drop-position', position);
}

// 内部関数: ターゲットページが指定された祖先ページの子孫かどうかを判定
// @param {number} targetId - チェック対象のページID
// @param {number} ancestorId - 祖先としてチェックするページID
// @returns {boolean} ターゲットが祖先の子孫の場合true
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

/**
 * ページツリーのドラッグ&ドロップ機能を初期化します
 * 
 * この関数は以下の処理を行います：
 * - 既存のすべてのページヘッダーにD&D機能を付与
 * - サイドバーとサイドバーコンテンツにドラッグイベントリスナーを設定
 * - サイドバーへのドロップでページをルート階層に移動できるようにする
 * 
 * 通常はアプリケーション起動時に1回のみ呼び出してください。
 */
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

        if (draggedPageId && (e.target === sc || e.target.classList.contains('sidebar__content') || e.target.id === 'pageTree' || e.target.classList.contains('page-list'))) {
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
        if (!sc.contains(e.relatedTarget) || (e.relatedTarget && e.relatedTarget.classList.contains('page-item__header'))) {
            if (dropIndicator && dropIndicator.parentNode && (e.relatedTarget && e.relatedTarget.classList.contains('page-item__header'))) {
                dropIndicator.style.display = 'none';
            }
        }
    });

    sc.addEventListener('drop', (e) => {
        if (dropIndicator) dropIndicator.style.display = 'none';

        if (e.target === sc || e.target.classList.contains('sidebar__content') || e.target.id === 'pageTree' || e.target.classList.contains('page-list')) {
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

/**
 * 現在存在するすべてのページヘッダーにドラッグ&ドロップ機能を付与します
 * 
 * この関数は`.page-item__header`クラスを持つすべての要素に対して
 * `attachDragDropToPageItem()`を適用します。
 * 
 * 既にD&D機能が付与されているヘッダーには重複してイベントリスナーは追加されません。
 */
export function attachDragDropToPageItems() {
    document.querySelectorAll('.page-item__header').forEach((header) => {
        attachDragDropToPageItem(header);
    });
}

/**
 * 個別のページヘッダーにドラッグ&ドロップ機能を付与します
 * 
 * この関数は指定されたヘッダー要素に以下のイベントリスナーを設定します：
 * - dragstart: ドラッグ開始時にドラッグ中のページIDを保存
 * - dragend: ドラッグ終了時にスタイルとクラスをリセット
 * - dragover: ドラッグ中にドロップ位置を計算し、視覚的フィードバックを表示
 * - dragenter: ドラッグ進入時にドロップクラスを適用
 * - dragleave: ドラッグ離脱時にドロップクラスを削除
 * - drop: ドロップ時にページの移動・並び替えを実行
 * 
 * @param {HTMLElement} header - ドラッグ&ドロップ機能を付与するページヘッダー要素
 *                               要素のIDは`header-{pageId}`の形式である必要があります
 * 
 * 注意: 既にD&D機能が付与されているヘッダー（`data-dnd-attached="1"`）には
 *       重複してイベントリスナーは追加されません。
 */
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
        document.querySelectorAll('.page-item__header').forEach((h) => clearDropClasses(h));
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