// エディタに画像のリサイズ機能を追加（8方向のハンドルで拡大縮小）
export function addImageResizeHandlers(quill) {
    const editor = quill.root;
    // エディタコンテナを取得（ハンドルを配置する親要素）
    const editorContainer = editor.closest('.ql-container') || editor.parentElement || document.body;
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
    
    // 画像を選択状態にしてリサイズハンドルを表示
    function selectElement(element) {
        deselectElement();
        selectedElement = element;
        
        // Quillの内部処理と競合しないように非同期でクラスを追加
        setTimeout(() => {
            if (selectedElement === element && element.isConnected) {
                try {
                    element.classList.add('selected');
                    
                    // Create resize handles (画像のみ)
                    if (element.tagName === 'IMG') {
                        createResizeHandles(element);
                    }
                } catch (e) {
                    console.warn('Error selecting element:', e);
                }
            }
        }, 0);
    }
    
    // 画像の周囲に8方向のリサイズハンドルを作成
    function createResizeHandles(element) {
        const rect = element.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const containerRect = editorContainer.getBoundingClientRect();
        
        // ハンドル用のコンテナを作成する（エディタの外側に配置）
        const container = document.createElement('div');
        container.className = 'image-resize-container';
        container.style.position = 'absolute';
        // エディタコンテナを基準にした位置を計算
        container.style.left = (rect.left - containerRect.left + editorContainer.scrollLeft) + 'px';
        container.style.top = (rect.top - containerRect.top + editorContainer.scrollTop) + 'px';
        container.style.width = rect.width + 'px';
        container.style.height = rect.height + 'px';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '10000';
        
        // 8つのハンドルを作成する
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.style.pointerEvents = 'all';
            handle.dataset.position = pos;
            
            handle.addEventListener('mousedown', startResize);
            container.appendChild(handle);
        });
        
        // エディタコンテナに配置（エディタの外側）
        editorContainer.style.position = 'relative';
        editorContainer.appendChild(container);
        resizeHandles = container;
    }
    
    // リサイズ操作を開始（初期位置とサイズを記録）
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
        
        // クラス追加も非同期で行う
        setTimeout(() => {
            if (selectedElement) {
                selectedElement.classList.add('resizing');
            }
        }, 0);
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }
    
    // マウス移動に応じて画像のサイズを変更（アスペクト比を維持）
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
    
    // リサイズ操作を終了してイベントリスナーを削除
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            resizeHandle = null;
            
            setTimeout(() => {
                if (selectedElement) {
                    selectedElement.classList.remove('resizing');
                }
            }, 0);
            
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }
    
    // リサイズハンドルの位置を画像の新しいサイズに合わせて更新
    function updateHandlesPosition() {
        if (!selectedElement || !resizeHandles) return;
        
        const rect = selectedElement.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const containerRect = editorContainer.getBoundingClientRect();
        
        resizeHandles.style.left = (rect.left - containerRect.left + editorContainer.scrollLeft) + 'px';
        resizeHandles.style.top = (rect.top - containerRect.top + editorContainer.scrollTop) + 'px';
        resizeHandles.style.width = rect.width + 'px';
        resizeHandles.style.height = rect.height + 'px';
    }
    
    // 画像の選択を解除してリサイズハンドルを削除
    function deselectElement() {
        if (selectedElement) {
            setTimeout(() => {
                if (selectedElement) {
                    selectedElement.classList.remove('selected', 'resizing');
                }
            }, 0);
            selectedElement = null;
        }
        if (resizeHandles) {
            resizeHandles.remove();
            resizeHandles = null;
        }
    }
    
    // 外側をクリックした時に選択を解除する
    document.addEventListener('click', (e) => {
        if (!editor.contains(e.target) && !e.target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    // 選択した要素（画像またはiframe）をDelete/Backspaceキーで削除
    document.addEventListener('keydown', (e) => {
        if (selectedElement && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (document.activeElement === editor || editor.contains(document.activeElement)) {
                e.preventDefault();
                selectedElement.remove();
                deselectElement();
            }
        }
    });
    
    // スクロール時にハンドルを更新する
    editorContainer.addEventListener('scroll', () => {
        if (selectedElement) {
            updateHandlesPosition();
        }
    });
    
    // エディタのスクロールも監視
    editor.addEventListener('scroll', () => {
        if (selectedElement) {
            updateHandlesPosition();
        }
    });
}
