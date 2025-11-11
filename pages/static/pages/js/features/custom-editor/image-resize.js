// 画像のリサイズ機能
export function setupImageResize(editor) {
    // 定数定義
    const MIN_IMAGE_WIDTH = 50;
    const EDITOR_PADDING = 20;
    const SELECTION_DELAY_MS = 0;

    const editorEl = editor.editor;
    const editorContainer = editorEl.parentElement || document.body;
    
    let selectedElement = null;
    let resizeHandles = null;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startWidth, startHeight;
    let aspectRatio = 1;
    
    // 画像をクリックで選択
    editorEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            e.stopPropagation();
            selectElement(e.target);
        } else if (e.target.tagName === 'A') {
            // リンクの場合は選択解除しない（リンクをクリック可能にする）
            return;
        } else if (!e.target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    function selectElement(element) {
        deselectElement();
        selectedElement = element;
        
        setTimeout(() => {
            if (selectedElement === element && element.isConnected) {
                element.classList.add('selected');
                createResizeHandles(element);
            }
        }, SELECTION_DELAY_MS);
    }
    
    function createResizeHandles(element) {
        const rect = element.getBoundingClientRect();
        const containerRect = editorContainer.getBoundingClientRect();
        
        const container = document.createElement('div');
        container.className = 'image-resize-container';
        container.style.position = 'absolute';
        container.style.left = (rect.left - containerRect.left + editorContainer.scrollLeft) + 'px';
        container.style.top = (rect.top - containerRect.top + editorContainer.scrollTop) + 'px';
        container.style.width = rect.width + 'px';
        container.style.height = rect.height + 'px';
        container.style.pointerEvents = 'none';
        
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.style.pointerEvents = 'all';
            handle.dataset.position = pos;
            handle.addEventListener('mousedown', startResize);
            container.appendChild(handle);
        });
        
        editorContainer.style.position = 'relative';
        editorContainer.appendChild(container);
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
        
        newWidth = Math.max(MIN_IMAGE_WIDTH, Math.min(newWidth, editorEl.clientWidth - EDITOR_PADDING));
        newHeight = newWidth / aspectRatio;
        
        selectedElement.style.width = newWidth + 'px';
        selectedElement.style.height = newHeight + 'px';
        updateHandlesPosition();
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            resizeHandle = null;
            if (selectedElement) {
                selectedElement.classList.remove('resizing');
            }
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }
    
    function updateHandlesPosition() {
        if (!selectedElement || !resizeHandles) return;
        
        const rect = selectedElement.getBoundingClientRect();
        const containerRect = editorContainer.getBoundingClientRect();
        
        resizeHandles.style.left = (rect.left - containerRect.left + editorContainer.scrollLeft) + 'px';
        resizeHandles.style.top = (rect.top - containerRect.top + editorContainer.scrollTop) + 'px';
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
    
    // 外側クリックで選択解除
    document.addEventListener('click', (e) => {
        if (!editorEl.contains(e.target) && !e.target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    // Delete/Backspaceで削除
    document.addEventListener('keydown', (e) => {
        if (selectedElement && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (document.activeElement === editorEl || editorEl.contains(document.activeElement)) {
                e.preventDefault();
                selectedElement.remove();
                deselectElement();
                editor.updatePlaceholder();
            }
        }
    });
    
    // スクロール時にハンドル更新
    editorContainer.addEventListener('scroll', () => {
        if (selectedElement) {
            updateHandlesPosition();
        }
    });
}
