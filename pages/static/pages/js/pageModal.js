// Page creation modal management

let createQuill = null;

export function openCreateModal() {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    
    modalTitle.textContent = '新しいページを作成';
    parentIdInput.value = '';
    modal.style.display = 'block';
}

export function openCreateChildModal(parentId, parentTitle) {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal-header h2');
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
    
    if (createQuill) {
        createQuill.setContents([]);
    }
    
    // Reset modal size and position
    modalContent.style.width = '600px';
    modalContent.style.height = '';
    modalContent.style.left = '50%';
    modalContent.style.top = '50%';
    modalContent.style.transform = 'translate(-50%, -50%)';
}

export function handleCreatePage(event, addPageToTree, showSaveIndicator, escapeHtml) {
    event.preventDefault();
    
    // Get content from Quill editor
    if (createQuill) {
        const content = createQuill.root.innerHTML;
        document.getElementById('newPageContent').value = content;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    const parentIdInput = document.querySelector('[name="parent_id"]');
    const parentId = parentIdInput.value;
    const title = document.getElementById('newPageTitle').value;
    
    fetch(form.action, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeCreateModal();
            
            // Add new page to tree without reload
            addPageToTree(data.page_id, title, parentId, escapeHtml);
            
            // Show success message
            showSaveIndicator('ページを作成しました ✓');
        } else {
            alert('エラー: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error creating page:', error);
        alert('ページの作成に失敗しました');
    });
    
    return false;
}

export function setCreateQuill(quill) {
    createQuill = quill;
}

export function getCreateQuill() {
    return createQuill;
}

// Modal resize functionality
export function initModalResize() {
    const modalContent = document.getElementById('modalContent');
    const handles = modalContent.querySelectorAll('.resize-handle');
    
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentHandle = handle;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = modalContent.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startLeft = rect.left;
            startTop = rect.top;
            
            modalContent.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        if (currentHandle.classList.contains('resize-handle-r') || 
            currentHandle.classList.contains('resize-handle-tr') || 
            currentHandle.classList.contains('resize-handle-br')) {
            newWidth = Math.max(400, startWidth + deltaX);
        }
        
        if (currentHandle.classList.contains('resize-handle-l') || 
            currentHandle.classList.contains('resize-handle-tl') || 
            currentHandle.classList.contains('resize-handle-bl')) {
            newWidth = Math.max(400, startWidth - deltaX);
            newLeft = startLeft + (startWidth - newWidth);
        }
        
        if (currentHandle.classList.contains('resize-handle-b') || 
            currentHandle.classList.contains('resize-handle-bl') || 
            currentHandle.classList.contains('resize-handle-br')) {
            newHeight = Math.max(300, startHeight + deltaY);
        }
        
        if (currentHandle.classList.contains('resize-handle-t') || 
            currentHandle.classList.contains('resize-handle-tl') || 
            currentHandle.classList.contains('resize-handle-tr')) {
            newHeight = Math.max(300, startHeight - deltaY);
            newTop = startTop + (startHeight - newHeight);
        }
        
        // Apply constraints
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8;
        newWidth = Math.min(newWidth, maxWidth);
        newHeight = Math.min(newHeight, maxHeight);
        
        modalContent.style.width = newWidth + 'px';
        modalContent.style.height = newHeight + 'px';
        modalContent.style.left = newLeft + 'px';
        modalContent.style.top = newTop + 'px';
        modalContent.style.transform = 'none';
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            modalContent.classList.remove('resizing');
        }
    });
}

