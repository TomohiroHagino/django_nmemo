// Quill editor initialization and image handling

export function initCreateEditor(imageHandler, addImageResizeHandlers, addDragDropImageUpload) {
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
    
    const createQuill = new Quill('#createEditor', {
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
    
    // SIMPLE FIX: Just boost z-index, don't move anything
    setTimeout(() => {
        const container = document.querySelector('#createEditor.ql-container');
        if (!container) return;
        
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        
        // Set very high z-index
        tooltip.style.setProperty('z-index', '999999999', 'important');
    }, 100);
    
    // Add custom image resize functionality
    addImageResizeHandlers(createQuill);
    
    // Add drag and drop image upload
    addDragDropImageUpload(createQuill, true);
    
    return createQuill;
}

export function initContentEditor(initialContent, imageHandler, addImageResizeHandlers, addDragDropImageUpload) {
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
    
    const contentQuill = new Quill('#contentEditor', {
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
    
    // SIMPLE FIX: Just boost z-index, don't move anything
    setTimeout(() => {
        const container = document.querySelector('#contentEditor.ql-container');
        if (!container) return;
        
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        
        // Set very high z-index
        tooltip.style.setProperty('z-index', '999999999', 'important');
    }, 100);
    
    // Set initial content
    if (initialContent) {
        contentQuill.root.innerHTML = initialContent;
    }
    
    // Add custom image resize functionality
    addImageResizeHandlers(contentQuill);
    
    // Add drag and drop image upload
    addDragDropImageUpload(contentQuill, false);
    
    return contentQuill;
}

export function imageHandler(currentPageId, getCreateQuill) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    
    const self = this; // Save context to determine which editor is being used
    const createQuill = getCreateQuill();
    
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
            alert('画像のアップロードに失敗しました');
        }
    };
}

// Add drag and drop image upload functionality
export function addDragDropImageUpload(quill, isCreateModal, currentPageId) {
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
                alert('画像のアップロードに失敗しました');
            }
        }
    }, false);
}

// Custom image resize functionality
export function addImageResizeHandlers(quill) {
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

