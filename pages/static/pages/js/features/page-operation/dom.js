// pages/static/pages/js/features/page-operation/dom.js
export function markActiveHeader(pageId) {
  document.querySelectorAll('.page-item__header').forEach(el => el.classList.remove('active'));
  const header = document.getElementById('header-' + pageId);
  if (header) header.classList.add('active');
}

export function renderContentArea(pageId, data, escapeHtml, formatDate) {
  const contentArea = document.getElementById('pageContent');
  if (!contentArea) {
    console.error('pageContent element not found');
    return;
  }
  
  contentArea.innerHTML = `
      <div class="page-content-wrapper">
          <h1 class="page-content__title" contenteditable="true" id="pageTitle">${escapeHtml(data.title)}</h1>
          <div class="page-meta">
              <span>作成: ${formatDate(data.created_at)}</span>
              <span>更新: ${formatDate(data.updated_at)}</span>
          </div>
          <div id="contentEditor" class="content-editor"></div>
          <div class="edit-buttons">
              <button onclick="savePage()" class="btn btn--primary">💾 保存</button>
              <button onclick="cancelEdit()" class="btn" style="background: #6c757d; color: white;">キャンセル</button>
              <a href="/page/${pageId}/export/" class="btn btn-success" title="JSONファイルとしてエクスポート">📥 JSON</a>
              <button onclick="deletePage(${pageId})" class="btn btn--danger">🗑️ 削除</button>
          </div>
      </div>
  `;
}

export function renderEmpty() {
  const contentArea = document.getElementById('pageContent');
  if (contentArea) {
    contentArea.innerHTML = '<div class="content-empty">← 左側のページを選択してください</div>';
  }
}

export function renderLoadError() {
  const contentArea = document.getElementById('pageContent');
  if (contentArea) {
    contentArea.innerHTML = '<div class="content-empty">ページの読み込みに失敗しました</div>';
  }
}

export function updateTreeTitle(pageId, title) {
  const treeTitle = document.querySelector(`#header-${pageId} .page-item__title`);
  if (treeTitle) treeTitle.textContent = title;
}