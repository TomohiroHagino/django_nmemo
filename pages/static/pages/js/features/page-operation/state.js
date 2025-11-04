// pages/static/pages/js/features/page-operation/state.js
// 
// ページ操作に関する状態管理モジュール
// 
// 【使い方のルール】
// - このモジュール内の変数（currentPageId, originalTitle, originalContent）は
//   モジュールスコープのため、外部から直接アクセスできません
// - 必ず提供された関数（getCurrentPageId(), setCurrentPageId() など）を使用してください
// - これにより、状態管理を一元化し、将来の拡張性を確保します
//
// 【使用例】
//   import { getCurrentPageId, setCurrentPageId, setOriginals, getOriginals, clearState } from './state.js';
//
//   // 現在のページIDを設定
//   setCurrentPageId(123);
//
//   // 現在のページIDを取得
//   const pageId = getCurrentPageId();
//
//   // 元のタイトルとコンテンツを保存（キャンセル時に使用）
//   setOriginals('タイトル', '<p>コンテンツ</p>');
//
//   // 元のタイトルとコンテンツを取得
//   const { originalTitle, originalContent } = getOriginals();
//
//   // 状態をクリア（ページ削除時など）
//   clearState();

// 現在選択されているページのID
let currentPageId = null;

// ページ読み込み時の元のタイトル（キャンセル時に復元するため）
let originalTitle = '';

// ページ読み込み時の元のコンテンツ（キャンセル時に復元するため）
let originalContent = '';

/**
 * 現在選択されているページIDを取得します
 * @returns {number|null} 現在のページID。ページが選択されていない場合はnull
 */
export function getCurrentPageId() {
    return currentPageId;
}

/**
 * 現在選択されているページIDを設定します
 * @param {number|null} id - 設定するページID
 */
export function setCurrentPageId(id) {
    currentPageId = id;
}

/**
 * ページ読み込み時の元のタイトルとコンテンツを保存します
 * キャンセル機能で元の状態に戻すために使用されます
 * @param {string} title - 元のタイトル
 * @param {string} content - 元のコンテンツ（HTML）
 */
export function setOriginals(title, content) {
    originalTitle = title;
    originalContent = content;
}

/**
 * 保存されている元のタイトルとコンテンツを取得します
 * @returns {{originalTitle: string, originalContent: string}} 元のタイトルとコンテンツのオブジェクト
 */
export function getOriginals() {
    return { originalTitle, originalContent };
}

/**
 * すべての状態をクリアします
 * ページ削除時などに使用されます
 */
export function clearState() {
    currentPageId = null;
    originalTitle = '';
    originalContent = '';
}