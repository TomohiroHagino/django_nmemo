// エディタに画像のドラッグ&ドロップアップロード機能を追加
export function addDragDropImageUpload(quill, isCreateModal, currentPageId) {
    const editor = quill.root;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
    });
    
    // ドラッグイベントのデフォルト動作を防止
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
        
        // ドロップした位置を取得
        const range = quill.getSelection(true);
        let insertIndex = range ? range.index : quill.getLength();
        
        // マウス位置から正確な挿入位置を計算
        const editorBounds = editor.getBoundingClientRect();
        const dropY = e.clientY - editorBounds.top;
        const dropX = e.clientX - editorBounds.left;
        
        // Quillの内部APIを使用して正確な位置を取得
        try {
            const blot = quill.scroll.find(e.target);
            if (blot) {
                const offset = blot.offset(quill.scroll);
                insertIndex = offset;
            }
        } catch (err) {
            // フォールバック: 現在の選択位置を使用
            insertIndex = range ? range.index : quill.getLength();
        }
        
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
                    // ドロップした位置に画像を挿入
                    quill.insertEmbed(insertIndex, 'image', data.url);
                    quill.insertText(insertIndex + 1, '\n'); // 画像の後に改行を追加
                    // 次の画像用にインデックスを更新
                    insertIndex += 2; // 画像 + 改行
                } else {
                    alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('画像のアップロードに失敗しました');
            }
        }
    }, false);
}

// エディタに動画のドラッグ&ドロップアップロード機能を追加
export function addDragDropVideoUpload(quill, isCreateModal, currentPageId) {
    const editor = quill.root;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
    });
    
    // ドラッグイベントのデフォルト動作を防止
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
        
        // ドロップした位置を取得
        const range = quill.getSelection(true);
        let insertIndex = range ? range.index : quill.getLength();
        
        // マウス位置から正確な挿入位置を計算
        const editorBounds = editor.getBoundingClientRect();
        const dropY = e.clientY - editorBounds.top;
        const dropX = e.clientX - editorBounds.left;
        
        // Quillの内部APIを使用して正確な位置を取得
        try {
            const blot = quill.scroll.find(e.target);
            if (blot) {
                const offset = blot.offset(quill.scroll);
                insertIndex = offset;
            }
        } catch (err) {
            // フォールバック: 現在の選択位置を使用
            insertIndex = range ? range.index : quill.getLength();
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is a video
            if (!file.type.startsWith('video/')) {
                continue; // Skip non-video files
            }
            
            // Validate file size (250MB max)
            if (file.size > 250 * 1024 * 1024) {
                alert(`ファイル "${file.name}" のサイズは250MB以下にしてください`);
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
                    // ドロップした位置に動画を挿入
                    quill.insertEmbed(insertIndex, 'video', data.url);
                    quill.insertText(insertIndex + 1, '\n'); // 動画の後に改行を追加
                    // 次の動画用にインデックスを更新
                    insertIndex += 2; // 動画 + 改行
                } else {
                    alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('動画のアップロードに失敗しました');
            }
        }
    }, false);
}

