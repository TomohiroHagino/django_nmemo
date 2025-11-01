import { setCreateQuill, getCreateQuill, setTitleEnterPressed, resetState } from './page-modal-state.js';
import { focus } from '../../shared/quill/insert.js';

export { setCreateQuill }; // 公開

export function openCreateModal() {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = '新しいページを作成';
    parentIdInput.value = '';
    modal.style.display = 'block';

    setTimeout(() => {
        const titleInput = document.getElementById('newPageTitle');
        if (!titleInput) return;
        titleInput.focus();
        setTitleEnterPressed(false);
        titleInput.addEventListener('keydown', function handle(e) {
            if (e.key === 'Enter' && document.activeElement === titleInput) {
                setTitleEnterPressed(true);
                e.preventDefault();
                e.stopPropagation();
                const q = getCreateQuill();
                if (q) focus(q);
                titleInput.removeEventListener('keydown', handle);
            }
        }, true);
    }, 100);
}

export function openCreateChildModal(parentId, parentTitle) {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = `「${parentTitle}」の子ページを作成`;
    parentIdInput.value = parentId;
    modal.style.display = 'block';

    setTimeout(() => {
        const titleInput = document.getElementById('newPageTitle');
        if (!titleInput) return;
        titleInput.focus();
        setTitleEnterPressed(false);
        titleInput.addEventListener('keydown', function handle(e) {
            if (e.key === 'Enter' && document.activeElement === titleInput) {
                setTitleEnterPressed(true);
                e.preventDefault();
                e.stopPropagation();
                const q = getCreateQuill();
                if (q) focus(q);
                titleInput.removeEventListener('keydown', handle);
            }
        }, true);
    }, 100);
}

export function closeCreateModal() {
    const modal = document.getElementById('createModal');
    const modalContent = document.getElementById('modalContent');
    modal.style.display = 'none';
    document.getElementById('newPageTitle').value = '';
    resetState();
    const q = getCreateQuill();
    if (q) { q.setContents([]); }
    modalContent.style.width = '600px';
    modalContent.style.height = '';
    modalContent.style.left = '50%';
    modalContent.style.top = '50%';
    modalContent.style.transform = 'translate(-50%, -50%)';
}