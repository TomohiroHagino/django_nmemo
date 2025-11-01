import { createPageFlow } from '../services/pageService.js';

let createQuill = null;
let titleInputEnterPressed = false;

export function setCreateQuill(quill) { createQuill = quill; }

export function openCreateModal() {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal__header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');

    modalTitle.textContent = '新しいページを作成';
    parentIdInput.value = '';
    modal.style.display = 'block';

    setTimeout(() => {
        const titleInput = document.getElementById('newPageTitle');
        if (!titleInput) return;
        titleInput.focus();
        titleInputEnterPressed = false;
        titleInput.addEventListener('keydown', function handleTitleEnter(e) {
            if (e.key === 'Enter' && document.activeElement === titleInput) {
                titleInputEnterPressed = true;
                e.preventDefault();
                e.stopPropagation();
                if (createQuill) { createQuill.focus(); }
                titleInput.removeEventListener('keydown', handleTitleEnter);
            }
        }, true);
    }, 100);
}

export function openCreateChildModal(parentId, parentTitle) {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal__header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = `「${parentTitle}」の子ページを作成`;
    parentIdInput.value = parentId;
    modal.style.display = 'block';
}

export function closeCreateModal() {
    const modal = document.getElementById('createModal');
    const modalContent = document.getElementById('modalContent');
    modal.style.display = 'none';
    document.getElementById('newPageTitle').value = '';
    titleInputEnterPressed = false;
    if (createQuill) { createQuill.setContents([]); }
    modalContent.style.width = '600px';
    modalContent.style.height = '';
    modalContent.style.left = '50%';
    modalContent.style.top = '50%';
    modalContent.style.transform = 'translate(-50%, -50%)';
}

export async function handleCreatePage(event, addPageToTree, escapeHtml) {
    if (titleInputEnterPressed) {
        event.preventDefault();
        titleInputEnterPressed = false;
        return false;
    }
    event.preventDefault();

    if (createQuill) {
        const content = createQuill.root.innerHTML;
        document.getElementById('newPageContent').value = content;
    }

    const form = event.target;
    const formData = new FormData(form);
    const parentId = formData.get('parent_id') || '';
    const title = document.getElementById('newPageTitle').value;
    const contentHtml = document.getElementById('newPageContent').value;

    try {
        const { pageId } = await createPageFlow({ parentId, title, contentHtml });
        closeCreateModal();
        addPageToTree(pageId, title, parentId, escapeHtml);
    } catch (e) {
        alert('エラー: ' + (e.message || '不明なエラー'));
    }
    return false;
}

export function getCreateQuill() { return createQuill; }