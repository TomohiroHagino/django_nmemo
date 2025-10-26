// Quill editor initialization and image handling

export function initCreateEditor(imageHandler, videoHandler, addImageResizeHandlers, addDragDropImageUpload, addDragDropVideoUpload) {
    // カスタムフォントサイズを登録
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
    Quill.register(Size, true);
    
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
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
                    image: imageHandler,
                    video: videoHandler
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
    
    // Add drag and drop video upload
    addDragDropVideoUpload(createQuill, true);
    
    return createQuill;
}

export function initContentEditor(initialContent, imageHandler, videoHandler, addImageResizeHandlers, addDragDropImageUpload, addDragDropVideoUpload) {
    // カスタムフォントサイズを登録
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
    Quill.register(Size, true);
    
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
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
                    image: imageHandler,
                    video: videoHandler
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
    
    // Add drag and drop video upload
    addDragDropVideoUpload(contentQuill, false);
    
    return contentQuill;
}

export function videoHandler(currentPageId, getCreateQuill) {
    const self = this;
    const createQuill = getCreateQuill();
    
    // ユーザーに選択肢を提示
    const choice = prompt('1: YouTube/Vimeo URLを入力\n2: 動画ファイルをアップロード\n\n番号を入力してください (1 または 2):');
    
    if (choice === '1') {
        // YouTube/Vimeo URLを入力
        const url = prompt('YouTube または Vimeo の URL を入力してください:');
        if (!url) return;
        
        // YouTube/Vimeo URLを埋め込み用に変換
        let embedUrl = url;
        
        // YouTube URL の処理
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        
        // Vimeo URL の処理
        const vimeoRegex = /vimeo\.com\/(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        
        // エディタに埋め込み
        const quill = self.quill;
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'video', embedUrl);
        quill.setSelection(range.index + 1);
        
    } else if (choice === '2') {
        // ファイルアップロード
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'video/*');
        input.click();
        
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            
            // Validate file size (50MB max for videos)
            if (file.size > 50 * 1024 * 1024) {
                alert('動画ファイルサイズは50MB以下にしてください');
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
            
            // Upload video
            const formData = new FormData();
            formData.append('video', file);
            formData.append('page_id', pageId);
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/api/upload-video/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Insert video into editor
                    const quill = self.quill;
                    const range = quill.getSelection(true);
                    quill.insertEmbed(range.index, 'video', data.url);
                    quill.setSelection(range.index + 1);
                } else {
                    alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('動画のアップロードに失敗しました');
            }
        };
    }
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

// Add drag and drop video upload functionality
export function addDragDropVideoUpload(quill, isCreateModal, currentPageId) {
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
            
            // Check if file is a video
            if (!file.type.startsWith('video/')) {
                continue; // Skip non-video files
            }
            
            // Validate file size (50MB max)
            if (file.size > 50 * 1024 * 1024) {
                alert(`ファイル "${file.name}" のサイズは50MB以下にしてください`);
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
            
            // Upload video
            const formData = new FormData();
            formData.append('video', file);
            formData.append('page_id', pageId);
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/api/upload-video/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Insert video at the end of the editor
                    const length = quill.getLength();
                    quill.insertEmbed(length - 1, 'video', data.url);
                    quill.insertText(length, '\n'); // Add newline after video
                } else {
                    alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('動画のアップロードに失敗しました');
            }
        }
    }, false);
}

// Custom image and video resize functionality
export function addImageResizeHandlers(quill) {
    const editor = quill.root;
    let selectedElement = null; // Changed from selectedImage to support both img and iframe
    let resizeHandles = null;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let aspectRatio = 1;
    // Click on image to select (iframeはリサイズ不可とする)
    editor.addEventListener('click', (e) => {
        const target = e.target;
        
        // 画像をクリック
        if (target.tagName === 'IMG') {
            e.stopPropagation();
            selectElement(target);
            return;
        }
        
        // リサイズハンドル以外をクリック
        if (!target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    function selectElement(element) {
        deselectElement();
        selectedElement = element;
        element.classList.add('selected');
        
        // Create resize handles (画像のみ)
        if (element.tagName === 'IMG') {
            createResizeHandles(element);
        }
    }
    
    function createResizeHandles(element) {
        const rect = element.getBoundingClientRect();
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
        
        const rect = selectedElement.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = startWidth / startHeight;
        
        selectedElement.classList.add('resizing');
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }
    
    function doResize(e) {
        if (!isResizing || !selectedElement) return;
        
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
        
        selectedElement.style.width = newWidth + 'px';
        selectedElement.style.height = newHeight + 'px';
        
        // Update handles position
        updateHandlesPosition();
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            resizeHandle = null;
            selectedElement.classList.remove('resizing');
            
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }
    
    function updateHandlesPosition() {
        if (!selectedElement || !resizeHandles) return;
        
        const rect = selectedElement.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        
        resizeHandles.style.left = (rect.left - editorRect.left + editor.scrollLeft) + 'px';
        resizeHandles.style.top = (rect.top - editorRect.top + editor.scrollTop) + 'px';
        resizeHandles.style.width = rect.width + 'px';
        resizeHandles.style.height = rect.height + 'px';
    }
    
    function deselectElement() {
        if (selectedElement) {
            selectedElement.classList.remove('selected', 'resizing');
            selectedElement = null;
        }
        if (resizeHandles) {
            resizeHandles.remove();
            resizeHandles = null;
        }
    }
    
    // Deselect when clicking outside
    document.addEventListener('click', (e) => {
        if (!editor.contains(e.target) && !e.target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    // Delete selected element (image or iframe) with Delete/Backspace key
    document.addEventListener('keydown', (e) => {
        if (selectedElement && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (document.activeElement === editor || editor.contains(document.activeElement)) {
                e.preventDefault();
                selectedElement.remove();
                deselectElement();
            }
        }
    });
    
    // Update handles on scroll
    editor.addEventListener('scroll', () => {
        if (selectedElement) {
            updateHandlesPosition();
        }
    });
}

