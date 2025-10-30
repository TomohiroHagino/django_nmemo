import { createPage } from '../../api/pages.js';

import { closeCreateModal } from './page-modal-view.js';
import { isTitleEnterPressed, setTitleEnterPressed, getCreateQuill } from './page-modal-state.js';
import { showSaveIndicator } from '../../utils/notify.js';

export async function handleCreatePage(event, addPageToTree, escapeHtml) {
    if (isTitleEnterPressed()) {
        event.preventDefault();
        setTitleEnterPressed(false);
        return false;
    }
    event.preventDefault();

    const q = getCreateQuill();
    if (q) {
        const content = q.root.innerHTML;
        document.getElementById('newPageContent').value = content;
    }

    const form = event.target;
    const formData = new FormData(form);
    const parentId = formData.get('parent_id') || '';
    const title = document.getElementById('newPageTitle').value;
    const contentHtml = document.getElementById('newPageContent').value;

    try {
        const { pageId } = await createPage({ parentId, title, contentHtml });
        showSaveIndicator('ページを作成しました ✓');
        closeCreateModal();
        addPageToTree(pageId, title, parentId, escapeHtml);
    } catch (e) {
        alert('エラー: ' + (e.message || '不明なエラー'));
    }
    return false;
}
