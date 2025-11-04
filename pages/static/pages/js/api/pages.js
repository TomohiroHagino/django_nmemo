import { post } from './client.js';

/**
 * 新しいページを作成します
 * @param {Object} params - ページ作成パラメータ
 * @param {number|null} params.parentId - 親ページのID（ルートページの場合はnull）
 * @param {string} params.title - ページのタイトル
 * @param {string} params.contentHtml - ページのコンテンツ（HTML形式）
 * @returns {Promise<{pageId: number}>} 作成されたページのIDを含むオブジェクト
 * @throws {Error} 作成に失敗した場合
 */
export async function createPage({ parentId, title, contentHtml }) {
    const form = new FormData();
    if (parentId) form.append('parent_id', parentId);
    form.append('title', title);
    form.append('content', contentHtml);
    const data = await post('/page/create/', form, { asJson: true });
    if (!data.success) throw new Error(data.error || 'create failed');
    return { pageId: data.page_id };
}

/**
 * 指定されたIDのページ情報を取得します
 * @param {number} pageId - 取得するページのID
 * @returns {Promise<Object>} ページ情報（title, content, created_at, updated_atなど）
 */
export async function fetchPage(pageId) {
    const response = await fetch(`/api/page/${pageId}/`);
    return await response.json();
}

/**
 * 既存のページを更新します
 * @param {number} pageId - 更新するページのID
 * @param {string} title - 新しいタイトル
 * @param {string} content - 新しいコンテンツ（HTML形式）
 * @param {string} csrfToken - CSRFトークン
 * @returns {Promise<Object>} 更新結果（success: boolean, error?: string）
 */
export async function updatePage(pageId, title, content, csrfToken) {
    const response = await fetch(`/page/${pageId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({ 'title': title, 'content': content })
    });
    return await response.json();
}

/**
 * 指定されたIDのページを削除します
 * @param {number} pageId - 削除するページのID
 * @param {string} csrfToken - CSRFトークン
 * @returns {Promise<Object>} 削除結果（success: boolean, error?: string）
 */
export async function removePage(pageId, csrfToken) {
    const response = await fetch(`/page/${pageId}/delete/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    return await response.json();
}

/**
 * ページを別の親ページの子として移動します
 * @param {number} pageId - 移動するページのID
 * @param {number|null} newParentId - 新しい親ページのID（ルート階層に移動する場合はnull）
 * @returns {Promise<Object>} 移動結果（success: boolean, error?: string）
 * @throws {Error} 移動に失敗した場合
 */
export async function movePageApi(pageId, newParentId) {
  const form = new FormData();
  form.append('new_parent_id', newParentId == null ? '' : newParentId);
  const data = await post(`/page/${pageId}/move/`, form, { asJson: true });
  if (!data.success) throw new Error(data.error || 'move failed');
  return data;
}

/**
 * ページの順序を変更します（兄弟ページ間での並び替え）
 * @param {number} pageId - 並び替えるページのID
 * @param {number} targetPageId - 基準となるターゲットページのID
 * @param {string} position - 配置位置（'before' または 'after'）
 * @returns {Promise<Object>} 並び替え結果（success: boolean, error?: string）
 * @throws {Error} 並び替えに失敗した場合
 */
export async function reorderPageApi(pageId, targetPageId, position) {
  const form = new FormData();
  form.append('target_page_id', targetPageId);
  form.append('position', position);
  const data = await post(`/page/${pageId}/reorder/`, form, { asJson: true });
  if (!data.success) throw new Error(data.error || 'reorder failed');
  return data;
}

/**
 * ページのアイコンを設定します
 * @param {number} pageId - アイコンを設定するページのID
 * @param {string} icon - アイコンの文字列（絵文字など）
 * @returns {Promise<Object>} 更新結果（success: boolean, error?: string）
 * @throws {Error} アイコン更新に失敗した場合
 */
export async function setPageIcon(pageId, icon) {
  const form = new FormData();
  form.append('icon', icon);
  const data = await post(`/page/${pageId}/icon/`, form, { asJson: true });
  if (!data.success) throw new Error(data.error || 'icon update failed');
  return data;
}