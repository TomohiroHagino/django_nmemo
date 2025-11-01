import { setCreateQuill, getCreateQuill, setTitleEnterPressed, resetState } from './page-modal-state.js';
import { focus } from '../../shared/quill/insert.js';

export { setCreateQuill }; // 公開

export function openCreateModal() {
    const modal = document.getElementById('createModal');
    if (!modal) {
        console.error('createModal not found');
        return;
    }
    
    const modalTitle = modal.querySelector('.modal__header h2');
    if (!modalTitle) {
        console.error('modal__header h2 not found in createModal');
        return;
    }
    
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = '新しいページを作成';
    if (parentIdInput) {
        parentIdInput.value = '';
    }
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
    if (!modal) {
        console.error('createModal not found');
        return;
    }
    
    const modalTitle = modal.querySelector('.modal__header h2');
    if (!modalTitle) {
        console.error('modal__header h2 not found in createModal');
        return;
    }
    
    const parentIdInput = document.querySelector('[name="parent_id"]');
    modalTitle.textContent = `「${parentTitle}」の子ページを作成`;
    if (parentIdInput) {
        parentIdInput.value = parentId;
    }
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
    if (!modal) return;
    
    const modalContent = document.getElementById('modalContent');
    modal.style.display = 'none';
    
    const titleInput = document.getElementById('newPageTitle');
    if (titleInput) {
        titleInput.value = '';
    }
    
    resetState();
    const q = getCreateQuill();
    if (q) { q.setContents([]); }
    
    if (modalContent) {
        modalContent.style.width = '600px';
        modalContent.style.height = '';
        modalContent.style.left = '50%';
        modalContent.style.top = '50%';
        modalContent.style.transform = 'translate(-50%, -50%)';
    }
}