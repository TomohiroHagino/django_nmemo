let currentPageId = null;
let createQuill = null;
let contentQuill = null;

function openCreateModal() {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    
    modalTitle.textContent = '新しいページを作成';
    parentIdInput.value = '';
    modal.style.display = 'block';
}

function openCreateChildModal(parentId, parentTitle) {
    const modal = document.getElementById('createModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const parentIdInput = document.querySelector('[name="parent_id"]');
    
    modalTitle.textContent = `「${parentTitle}」の子ページを作成`;
    parentIdInput.value = parentId;
    modal.style.display = 'block';
}

function closeCreateModal() {
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

function handleCreatePage(event) {
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
            addPageToTree(data.page_id, title, parentId);
            
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

function addPageToTree(pageId, title, parentId) {
    const now = new Date().toISOString();
    
    // Create new page item HTML
    const pageItemHtml = `
        <div class="page-item">
            <div class="page-item-header" id="header-${pageId}">
                <button class="toggle-btn empty">▼</button>
                <span class="page-icon" onclick="event.stopPropagation(); openIconModal(${pageId}, '📄')" title="アイコンを変更">📄</span>
                <span class="page-item-title" onclick="loadPage(${pageId})" style="flex: 1;">
                    ${escapeHtml(title)}
                </span>
                <div class="actions">
                    <button class="btn" style="background: transparent; color: #37352f; font-size: 16px; padding: 4px 6px; border: none; cursor: pointer; font-weight: bold;" onclick="event.stopPropagation(); openCreateChildModal(${pageId}, '${escapeHtml(title).replace(/'/g, "\\'")}');" title="子ページを追加">+</button>
                    <a href="/page/${pageId}/export/" class="btn" style="background: #28a745; color: white; text-decoration: none; font-size: 11px; padding: 4px 8px;" onclick="event.stopPropagation();" title="エクスポート">📥</a>
                </div>
            </div>
        </div>
    `;
    
    if (parentId) {
        // Add as child to parent
        let childrenContainer = document.getElementById('children-' + parentId);
        
        // If children container doesn't exist, create it
        if (!childrenContainer) {
            const parentHeader = document.getElementById('header-' + parentId);
            const parentItem = parentHeader.parentElement;
            
            // Update parent's toggle button
            const toggleBtn = parentHeader.querySelector('.toggle-btn');
            toggleBtn.id = 'toggle-' + parentId;
            toggleBtn.classList.remove('empty');
            toggleBtn.classList.add('collapsed');
            toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
            
            // Create children container
            childrenContainer = document.createElement('div');
            childrenContainer.id = 'children-' + parentId;
            childrenContainer.className = 'children';
            parentItem.appendChild(childrenContainer);
        }
        
        // Add new page to children
        childrenContainer.insertAdjacentHTML('beforeend', pageItemHtml);
        
        // Expand parent to show new child
        childrenContainer.classList.add('expanded');
        const toggleBtn = document.getElementById('toggle-' + parentId);
        if (toggleBtn) {
            toggleBtn.classList.remove('collapsed');
        }
    } else {
        // Add as root page
        const pageTree = document.getElementById('pageTree');
        if (pageTree) {
            pageTree.insertAdjacentHTML('beforeend', pageItemHtml);
        } else {
            // If tree doesn't exist (was empty), recreate it
            const sidebarContent = document.querySelector('.sidebar-content');
            const emptyState = sidebarContent.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
            
            const newTree = document.createElement('div');
            newTree.className = 'page-list';
            newTree.id = 'pageTree';
            newTree.innerHTML = pageItemHtml;
            sidebarContent.appendChild(newTree);
        }
    }
}

function toggleChildren(pageId) {
    const childrenElement = document.getElementById('children-' + pageId);
    const toggleBtn = document.getElementById('toggle-' + pageId);
    
    if (childrenElement) {
        if (childrenElement.classList.contains('expanded')) {
            childrenElement.classList.remove('expanded');
            toggleBtn.classList.add('collapsed');
        } else {
            childrenElement.classList.add('expanded');
            toggleBtn.classList.remove('collapsed');
        }
    }
}

let saveTimeout = null;
let originalTitle = '';
let originalContent = '';

function loadPage(pageId) {
    // Remove active class from all items
    document.querySelectorAll('.page-item-header').forEach(el => {
        el.classList.remove('active');
    });
    
    // Add active class to clicked item
    const header = document.getElementById('header-' + pageId);
    if (header) {
        header.classList.add('active');
    }
    
    currentPageId = pageId;
    
    // Fetch page content
    fetch(`/api/page/${pageId}/`)
        .then(response => response.json())
        .then(data => {
            originalTitle = data.title;
            originalContent = data.content;
            
            const contentArea = document.getElementById('pageContent');
            contentArea.innerHTML = `
                <div style="max-width: 900px; margin: 0 auto;">
                    <h1 class="page-title-main" contenteditable="true" id="pageTitle">${escapeHtml(data.title)}</h1>
                    <div class="page-meta">
                        <span>作成: ${formatDate(data.created_at)}</span>
                        <span>更新: ${formatDate(data.updated_at)}</span>
                    </div>
                    <div id="contentEditor"></div>
                    <div class="edit-buttons">
                        <button onclick="savePage()" class="btn btn-primary">💾 保存</button>
                        <button onclick="cancelEdit()" class="btn" style="background: #6c757d; color: white;">キャンセル</button>
                        <a href="/page/${pageId}/export/" class="btn btn-success">📥 エクスポート</a>
                        <button onclick="deletePage(${pageId})" class="btn btn-danger">🗑️ 削除</button>
                    </div>
                </div>
            `;
            
            // Initialize Quill editor for content
            initContentEditor(data.content);
            
            // Add input listeners for auto-save indication
            const titleEl = document.getElementById('pageTitle');
            
            if (titleEl) {
                titleEl.addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        // Auto-save after 2 seconds of inactivity
                        // savePage();
                    }, 2000);
                });
                
                // Prevent line breaks in title
                titleEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (contentQuill) {
                            contentQuill.focus();
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error loading page:', error);
            const contentArea = document.getElementById('pageContent');
            contentArea.innerHTML = '<div class="content-empty">ページの読み込みに失敗しました</div>';
        });
}

function savePage() {
    if (!currentPageId) return;
    
    const titleEl = document.getElementById('pageTitle');
    
    if (!titleEl || !contentQuill) return;
    
    const title = titleEl.textContent.trim();
    const content = contentQuill.root.innerHTML;
    
    if (!title) {
        alert('タイトルは必須です');
        return;
    }
    
    // Get CSRF token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    // Show saving indicator
    showSaveIndicator('保存中...');
    
    // Send update request
    fetch(`/page/${currentPageId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
            'title': title,
            'content': content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSaveIndicator('保存しました ✓');
            originalTitle = title;
            originalContent = content;
            
            // Update tree item title
            const treeTitle = document.querySelector(`#header-${currentPageId} .page-item-title`);
            if (treeTitle) {
                treeTitle.textContent = title;
            }
        } else {
            alert('保存に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error saving page:', error);
        alert('保存に失敗しました');
    });
}

function cancelEdit() {
    const titleEl = document.getElementById('pageTitle');
    
    if (titleEl) titleEl.textContent = originalTitle;
    if (contentQuill) {
        contentQuill.root.innerHTML = originalContent;
    }
}

function deletePage(pageId) {
    if (!confirm('このページを削除しますか？\n子ページがある場合、すべて削除されます。')) {
        return;
    }
    
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    fetch(`/page/${pageId}/delete/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remove from tree
            const pageHeader = document.getElementById('header-' + pageId);
            if (pageHeader) {
                const pageItem = pageHeader.parentElement;
                pageItem.remove();
            }
            
            // Clear content area
            const contentArea = document.getElementById('pageContent');
            contentArea.innerHTML = '<div class="content-empty">← 左側のページを選択してください</div>';
            currentPageId = null;
            
            showSaveIndicator('ページを削除しました ✓');
        } else {
            alert('削除に失敗しました');
        }
    })
    .catch(error => {
        console.error('Error deleting page:', error);
        alert('削除に失敗しました');
    });
}

function showSaveIndicator(message) {
    let indicator = document.getElementById('saveIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'saveIndicator';
        indicator.className = 'save-indicator';
        document.body.appendChild(indicator);
    }
    
    indicator.textContent = message;
    indicator.classList.add('show');
    
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP');
}

// モーダル外クリックで閉じる
window.onclick = function(event) {
    const createModal = document.getElementById('createModal');
    if (event.target == createModal) {
        closeCreateModal();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Cmd+S (Mac) or Ctrl+S (Windows/Linux) to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentPageId) {
            savePage();
        }
    }
});

// Initialize on page load
window.addEventListener('load', () => {
    // Initialize modal resize functionality
    initModalResize();
    
    // Initialize Quill editor for create modal
    initCreateEditor();
    
    // Initialize drag and drop for page tree
    initPageTreeDragDrop();
});

// Modal resize functionality
function initModalResize() {
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

// Initialize Quill editor for create modal
function initCreateEditor() {
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image'],
        ['clean']
    ];
    
    // Register Image Resize Module if available
    if (window.ImageResize) {
        Quill.register('modules/imageResize', window.ImageResize.default);
    }
    
    createQuill = new Quill('#createEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandler
                }
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize']
            }
        },
        placeholder: 'コンテンツを入力してください...'
    });
    
    // Add custom image resize functionality
    addImageResizeHandlers(createQuill);
    
    // Add drag and drop image upload
    addDragDropImageUpload(createQuill, true);
}

// Initialize Quill editor for content viewing/editing
function initContentEditor(initialContent) {
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image'],
        ['clean']
    ];
    
    // Register Image Resize Module if available
    if (window.ImageResize) {
        Quill.register('modules/imageResize', window.ImageResize.default);
    }
    
    contentQuill = new Quill('#contentEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandler
                }
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize']
            }
        },
        placeholder: 'コンテンツを入力してください...'
    });
    
    // Set initial content
    if (initialContent) {
        contentQuill.root.innerHTML = initialContent;
    }
    
    // Add custom image resize functionality
    addImageResizeHandlers(contentQuill);
    
    // Add drag and drop image upload
    addDragDropImageUpload(contentQuill, false);
}

// Add drag and drop image upload functionality
function addDragDropImageUpload(quill, isCreateModal) {
    const editor = quill.root;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        editor.addEventListener(eventName, () => {
            editor.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, () => {
            editor.classList.remove('drag-over');
        }, false);
    });
    
    // Handle dropped files
    editor.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length === 0) return;
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                continue; // Skip non-image files
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert(`ファイル "${file.name}" のサイズは5MB以下にしてください`);
                continue;
            }
            
            // Determine page ID
            let pageId;
            if (isCreateModal) {
                pageId = 'temp';
            } else {
                if (!currentPageId) {
                    alert('ページIDが取得できません。ページを再読み込みしてください。');
                    return;
                }
                pageId = currentPageId;
            }
            
            console.log('Drag & Drop upload - Page ID:', pageId, 'File:', file.name);
            
            // Upload image
            const formData = new FormData();
            formData.append('image', file);
            formData.append('page_id', pageId);
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/api/upload-image/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Insert image at the end of the editor
                    const length = quill.getLength();
                    quill.insertEmbed(length - 1, 'image', data.url);
                    quill.insertText(length, '\n'); // Add newline after image
                } else {
                    alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('画像のアップロードに失敗しました');
            }
        }
    }, false);
}

// Image upload handler for Quill
function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    
    const self = this; // Save context to determine which editor is being used
    
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('ファイルサイズは5MB以下にしてください');
            return;
        }
        
        // Determine which editor is being used
        const isCreateModal = (self.quill === createQuill);
        let pageId;
        
        if (isCreateModal) {
            // Creating new page - use temp folder
            pageId = 'temp';
        } else {
            // Editing existing page - must have currentPageId
            if (!currentPageId) {
                alert('ページIDが取得できません。ページを再読み込みしてください。');
                return;
            }
            pageId = currentPageId;
        }
        
        console.log('Image upload - Page ID:', pageId, 'Editor:', isCreateModal ? 'create' : 'content');
        
        // Upload image
        const formData = new FormData();
        formData.append('image', file);
        formData.append('page_id', pageId);
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        try {
            const response = await fetch('/api/upload-image/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Insert image into editor
                const quill = self.quill;
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', data.url);
                quill.setSelection(range.index + 1);
            } else {
                alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('画像のアップロードに失敗しました');
        }
    };
}

// Custom image resize functionality
function addImageResizeHandlers(quill) {
    const editor = quill.root;
    let selectedImage = null;
    let resizeHandles = null;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let aspectRatio = 1;
    
    // Click on image to select
    editor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.stopPropagation();
            selectImage(e.target);
        } else if (!e.target.classList.contains('resize-handle')) {
            deselectImage();
        }
    });
    
    function selectImage(img) {
        deselectImage();
        selectedImage = img;
        img.classList.add('selected');
        
        // Create resize handles
        createResizeHandles(img);
    }
    
    function createResizeHandles(img) {
        const rect = img.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        
        // Create container for handles
        const container = document.createElement('div');
        container.className = 'image-resize-container';
        container.style.position = 'absolute';
        container.style.left = (rect.left - editorRect.left + editor.scrollLeft) + 'px';
        container.style.top = (rect.top - editorRect.top + editor.scrollTop) + 'px';
        container.style.width = rect.width + 'px';
        container.style.height = rect.height + 'px';
        container.style.pointerEvents = 'none';
        
        // Create 8 handles
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.style.pointerEvents = 'all';
            handle.dataset.position = pos;
            
            handle.addEventListener('mousedown', startResize);
            container.appendChild(handle);
        });
        
        editor.style.position = 'relative';
        editor.appendChild(container);
        resizeHandles = container;
    }
    
    function startResize(e) {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        resizeHandle = e.target.dataset.position;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = selectedImage.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = startWidth / startHeight;
        
        selectedImage.classList.add('resizing');
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }
    
    function doResize(e) {
        if (!isResizing || !selectedImage) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        // Calculate new dimensions based on handle position
        switch(resizeHandle) {
            case 'se':
            case 'e':
                newWidth = startWidth + deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 'sw':
            case 'w':
                newWidth = startWidth - deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 'ne':
                newWidth = startWidth + deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 'nw':
                newWidth = startWidth - deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 's':
                newHeight = startHeight + deltaY;
                newWidth = newHeight * aspectRatio;
                break;
            case 'n':
                newHeight = startHeight - deltaY;
                newWidth = newHeight * aspectRatio;
                break;
        }
        
        // Apply constraints
        newWidth = Math.max(50, Math.min(newWidth, editor.clientWidth - 20));
        newHeight = newWidth / aspectRatio;
        
        selectedImage.style.width = newWidth + 'px';
        selectedImage.style.height = newHeight + 'px';
        
        // Update handles position
        updateHandlesPosition();
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            resizeHandle = null;
            selectedImage.classList.remove('resizing');
            
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }
    
    function updateHandlesPosition() {
        if (!selectedImage || !resizeHandles) return;
        
        const rect = selectedImage.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        
        resizeHandles.style.left = (rect.left - editorRect.left + editor.scrollLeft) + 'px';
        resizeHandles.style.top = (rect.top - editorRect.top + editor.scrollTop) + 'px';
        resizeHandles.style.width = rect.width + 'px';
        resizeHandles.style.height = rect.height + 'px';
    }
    
    function deselectImage() {
        if (selectedImage) {
            selectedImage.classList.remove('selected', 'resizing');
            selectedImage = null;
        }
        if (resizeHandles) {
            resizeHandles.remove();
            resizeHandles = null;
        }
    }
    
    // Deselect when clicking outside
    document.addEventListener('click', (e) => {
        if (!editor.contains(e.target) && !e.target.classList.contains('resize-handle')) {
            deselectImage();
        }
    });
    
    // Delete selected image with Delete/Backspace key
    document.addEventListener('keydown', (e) => {
        if (selectedImage && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (document.activeElement === editor || editor.contains(document.activeElement)) {
                e.preventDefault();
                selectedImage.remove();
                deselectImage();
            }
        }
    });
    
    // Update handles on scroll
    editor.addEventListener('scroll', () => {
        if (selectedImage) {
            updateHandlesPosition();
        }
    });
}

// Initialize drag and drop for page tree
function initPageTreeDragDrop() {
    const pageTree = document.getElementById('pageTree');
    if (!pageTree) return;
    
    // Add drag and drop to all page items
    attachDragDropToPageItems();
    
    // Allow dropping on the sidebar to move to root
    const sidebar = document.querySelector('.sidebar');
    const sidebarContent = document.querySelector('.sidebar-content');
    
    if (sidebar && sidebarContent) {
        // Add dragover to prevent default
        sidebar.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        sidebarContent.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        // Allow dropping on sidebar content to move to root
        sidebarContent.addEventListener('drop', function(e) {
            // Only handle if dropped on the sidebar content itself, not on a page item
            if (e.target === sidebarContent || e.target.classList.contains('sidebar-content') || 
                e.target.id === 'pageTree' || e.target.classList.contains('page-list')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Move to root (parent_id = null)
                if (draggedPageId) {
                    movePage(draggedPageId, null);
                }
            }
        });
    }
}

function attachDragDropToPageItems() {
    const pageItems = document.querySelectorAll('.page-item-header');
    
    pageItems.forEach(header => {
        // Make draggable
        header.setAttribute('draggable', 'true');
        
        // Drag events
        header.addEventListener('dragstart', handleDragStart);
        header.addEventListener('dragend', handleDragEnd);
        
        // Drop events
        header.addEventListener('dragover', handleDragOver);
        header.addEventListener('dragenter', handleDragEnter);
        header.addEventListener('dragleave', handleDragLeave);
        header.addEventListener('drop', handleDrop);
    });
}

let draggedPageId = null;
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    const pageId = draggedElement.id.replace('header-', '');
    draggedPageId = pageId;
    
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    
    // Remove all drop-target classes
    document.querySelectorAll('.page-item-header').forEach(header => {
        header.classList.remove('drop-target');
    });
    
    // Reset draggedPageId
    draggedPageId = null;
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    const targetPageId = e.currentTarget.id.replace('header-', '');
    
    // Don't allow dropping on itself
    if (targetPageId === draggedPageId) {
        return;
    }
    
    e.currentTarget.classList.add('drop-target');
}

function handleDragLeave(e) {
    // Only remove if we're actually leaving the element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drop-target');
    }
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    
    const targetPageId = e.currentTarget.id.replace('header-', '');
    
    // Don't allow dropping on itself
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // Check if target is a descendant of dragged page
    if (isDescendant(targetPageId, draggedPageId)) {
        alert('子孫ページを親にはできません');
        e.currentTarget.classList.remove('drop-target');
        return;
    }
    
    // Move the page
    movePage(draggedPageId, targetPageId);
    
    e.currentTarget.classList.remove('drop-target');
    return false;
}

function isDescendant(targetId, ancestorId) {
    // Check if targetId is a descendant of ancestorId
    const targetElement = document.getElementById('header-' + targetId);
    if (!targetElement) return false;
    
    const targetItem = targetElement.closest('.page-item');
    let parent = targetItem.parentElement;
    
    while (parent) {
        if (parent.id === 'children-' + ancestorId) {
            return true;
        }
        
        // Move up to next parent
        const parentItem = parent.closest('.page-item');
        if (!parentItem) break;
        
        parent = parentItem.parentElement;
        if (parent && parent.id === 'pageTree') break;
    }
    
    return false;
}

function movePage(pageId, newParentId) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    
    // If newParentId is explicitly null or undefined, send it as an empty string
    if (newParentId === null || newParentId === undefined) {
        formData.append('new_parent_id', '');
    } else {
        formData.append('new_parent_id', newParentId);
    }
    
    fetch(`/page/${pageId}/move/`, {
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
            // Reload the page to show updated tree
            window.location.reload();
        } else {
            alert('移動に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error moving page:', error);
        alert('移動に失敗しました');
    });
}

// アイコン変更関連の変数
let currentIconPageId = null;
let selectedIcon = null;

// よく使われるアイコンのリスト
const commonIcons = [
    '📄', '📝', '📋', '📌', '📎', '📇', '📑', '📓', '📔', '📕',
    '📖', '📗', '📘', '📙', '📚', '📛', '📜', '📰', '📱', '💻',
    '🖥️', '⌨️', '🖱️', '💾', '💿', '📀', '📼', '📹', '📷', '📸',
    '🎬', '🎭', '🎨', '🎯', '🎲', '🔍', '🔎', '💰', '💡', '🔥',
    '🌟', '⭐', '✨', '💫', '🌈', '🌙', '☀️', '⛅', '☁️', '🌧️',
    '🌊', '🏔️', '🌍', '🗺️', '📍', '🚗', '🚕', '🚙', '🚌', '🚎',
    '🏠', '🏢', '🏫', '🏭', '🏰', '🗼', '⛪', '🕌', '🎪', '🎠',
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
    '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🎯',
    '🎮', '🎰', '🃏', '🀄', '♠️', '♥️', '♦️', '♣️', '🂠', '🎴'
];

function openIconModal(pageId, currentIcon) {
    currentIconPageId = pageId;
    selectedIcon = currentIcon;
    
    const modal = document.getElementById('iconModal');
    const iconGrid = document.getElementById('iconGrid');
    
    // アイコングリッドをクリア
    iconGrid.innerHTML = '';
    
    // アイコンを追加
    commonIcons.forEach(icon => {
        const iconBtn = document.createElement('button');
        iconBtn.textContent = icon;
        iconBtn.className = 'icon-btn';
        iconBtn.style.cssText = 'font-size: 24px; padding: 8px; border: 2px solid #e5e5e5; background: #fff; cursor: pointer; border-radius: 4px; transition: all 0.2s;';
        
        if (icon === currentIcon) {
            iconBtn.style.borderColor = '#2383e2';
            iconBtn.style.background = '#f0f7ff';
        }
        
        iconBtn.onmouseover = function() {
            // Don't change style if it's the current icon or selected
            const isCurrentIcon = icon === currentIcon;
            const isSelected = selectedIcon === icon;
            
            if (!isCurrentIcon && !isSelected) {
                this.style.borderColor = '#2383e2';
                this.style.background = '#f0f7ff';
            }
        };
        
        iconBtn.onmouseout = function() {
            // Only reset if it's not the current icon or not selected
            const isCurrentIcon = icon === currentIcon;
            const isSelected = selectedIcon === icon;
            
            if (!isCurrentIcon && !isSelected) {
                this.style.borderColor = '#e5e5e5';
                this.style.background = '#fff';
                this.style.transform = '';
            }
        };
        
        iconBtn.onclick = function() {
            // 他のボタンから選択を解除
            document.querySelectorAll('.icon-btn').forEach(btn => {
                btn.style.borderColor = '#e5e5e5';
                btn.style.background = '#fff';
            });
            
            // このボタンを選択
            selectedIcon = icon;
            this.style.borderColor = '#2383e2';
            this.style.background = '#f0f7ff';
            this.style.transform = 'scale(1.1)';
            
            // Keep the selection when mouseout
            this.onmouseout = function() {
                this.style.borderColor = '#2383e2';
                this.style.background = '#f0f7ff';
            };
            
            // Reset mouseout handler for other buttons
            document.querySelectorAll('.icon-btn').forEach(btn => {
                if (btn !== this) {
                    btn.onmouseout = function() {
                        this.style.borderColor = '#e5e5e5';
                        this.style.background = '#fff';
                        this.style.transform = '';
                    };
                }
            });
        };
        
        iconGrid.appendChild(iconBtn);
    });
    
    modal.style.display = 'block';
}

function closeIconModal() {
    document.getElementById('iconModal').style.display = 'none';
    currentIconPageId = null;
    selectedIcon = null;
}

function confirmIconChange() {
    if (!currentIconPageId || !selectedIcon) {
        return;
    }
    
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    formData.append('icon', selectedIcon);
    
    fetch(`/page/${currentIconPageId}/icon/`, {
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
            // アイコンを更新
            const iconElements = document.querySelectorAll(`.page-item-header[id="header-${currentIconPageId}"] .page-icon`);
            iconElements.forEach(el => {
                el.textContent = selectedIcon;
            });
            
            closeIconModal();
        } else {
            alert('アイコン変更に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error updating icon:', error);
        alert('アイコン変更に失敗しました');
    });
}

