// 統合されたファイルドラッグ&ドロップアップロード機能
// 画像、動画、エクセルファイルを1つのハンドラーで処理

// エディタ要素に既にイベントリスナーが登録されているか確認するためのマップ
const editorHandlersInitialized = new WeakMap();

// 統合されたドラッグ&ドロップハンドラーを追加
export function addDragDropFileUpload(quill, isCreateModal, currentPageId) {
    const editor = quill.root;
    
    // 既に初期化されている場合はスキップ
    if (editorHandlersInitialized.has(editor)) {
        return;
    }
    
    // 初期化済みマーク
    editorHandlersInitialized.set(editor, true);
    
    // ドラッグイベントのデフォルト動作を防止
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
    });
    
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
    
    // 統合されたdropハンドラー
    editor.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length === 0) return;
        
        // ドロップした位置を取得
        const range = quill.getSelection(true);
        let insertIndex = range ? range.index : quill.getLength();
        
        // マウス位置から正確な挿入位置を計算
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
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        if (!csrfToken) {
            alert('CSRFトークンが見つかりません');
            return;
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // 画像ファイルの処理
            if (file.type.startsWith('image/')) {
                if (file.size > 5 * 1024 * 1024) {
                    alert(`ファイル "${file.name}" のサイズは5MB以下にしてください`);
                    continue;
                }
                
                const formData = new FormData();
                formData.append('image', file);
                formData.append('page_id', pageId);
                
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
                        quill.insertEmbed(insertIndex, 'image', data.url);
                        quill.insertText(insertIndex + 1, '\n');
                        insertIndex += 2;
                    } else {
                        alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                    }
                } catch (error) {
                    alert('画像のアップロードに失敗しました');
                }
            }
            // 動画ファイルの処理
            else if (file.type.startsWith('video/')) {
                if (file.size > 250 * 1024 * 1024) {
                    alert(`ファイル "${file.name}" のサイズは250MB以下にしてください`);
                    continue;
                }
                
                const formData = new FormData();
                formData.append('video', file);
                formData.append('page_id', pageId);
                
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
                        quill.insertEmbed(insertIndex, 'video', data.url);
                        quill.insertText(insertIndex + 1, '\n');
                        insertIndex += 2;
                    } else {
                        alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                    }
                } catch (error) {
                    alert('動画のアップロードに失敗しました');
                }
            }
            // エクセルファイルとZIPファイルの処理
            else {
                const excelMimeTypes = [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel.sheet.macroEnabled.12'
                ];
                const zipMimeTypes = [
                    'application/zip',
                    'application/x-zip-compressed',
                    'application/x-zip'
                ];
                const fileExtension = file.name.split('.').pop().toLowerCase();
                const isExcelFile = excelMimeTypes.includes(file.type) || 
                                  ['xls', 'xlsx', 'xlsm'].includes(fileExtension);
                const isZipFile = zipMimeTypes.includes(file.type) || 
                                 fileExtension === 'zip';
                const isSketchFile = fileExtension === 'sketch';
                const isIcoFile = fileExtension === 'ico';
                
                if (isExcelFile) {
                    if (file.size > 50 * 1024 * 1024) {
                        alert(`ファイル "${file.name}" のサイズは50MB以下にしてください`);
                        continue;
                    }
                    
                    const formData = new FormData();
                    formData.append('excel', file);
                    formData.append('page_id', pageId);
                    
                    try {
                        const response = await fetch('/api/upload-excel/', {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken
                            },
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            const linkText = `📊 ${data.filename || file.name}`;
                            quill.insertText(insertIndex, linkText, 'link', data.url);
                            quill.insertText(insertIndex + linkText.length, '\n');
                            insertIndex += linkText.length + 1;
                            quill.setSelection(insertIndex);
                        } else {
                            alert('エクセルファイルのアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                        }
                    } catch (error) {
                        alert('エクセルファイルのアップロードに失敗しました');
                    }
                }
                else if (isZipFile) {
                    if (file.size > 100 * 1024 * 1024) {
                        alert(`ファイル "${file.name}" のサイズは100MB以下にしてください`);
                        continue;
                    }
                    
                    const formData = new FormData();
                    formData.append('zip', file);
                    formData.append('page_id', pageId);
                    
                    try {
                        const response = await fetch('/api/upload-zip/', {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken
                            },
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            const linkText = `📦 ${data.filename || file.name}`;
                            quill.insertText(insertIndex, linkText, 'link', data.url);
                            quill.insertText(insertIndex + linkText.length, '\n');
                            insertIndex += linkText.length + 1;
                            quill.setSelection(insertIndex);
                        } else {
                            alert('ZIPファイルのアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                        }
                    } catch (error) {
                        alert('ZIPファイルのアップロードに失敗しました');
                    }
                }
                else if (isSketchFile) {
                    if (file.size > 100 * 1024 * 1024) {
                        alert(`ファイル "${file.name}" のサイズは100MB以下にしてください`);
                        continue;
                    }
                    
                    const formData = new FormData();
                    formData.append('sketch', file);
                    formData.append('page_id', pageId);
                    
                    try {
                        const response = await fetch('/api/upload-sketch/', {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken
                            },
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            const linkText = `🎨 ${data.filename || file.name}`;
                            quill.insertText(insertIndex, linkText, 'link', data.url);
                            quill.insertText(insertIndex + linkText.length, '\n');
                            insertIndex += linkText.length + 1;
                            quill.setSelection(insertIndex);
                        } else {
                            alert('Sketchファイルのアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                        }
                    } catch (error) {
                        alert('Sketchファイルのアップロードに失敗しました');
                    }
                }
                else if (isIcoFile) {
                    if (file.size > 10 * 1024 * 1024) {
                        alert(`ファイル "${file.name}" のサイズは10MB以下にしてください`);
                        continue;
                    }
                    
                    const formData = new FormData();
                    formData.append('ico', file);
                    formData.append('page_id', pageId);
                    
                    try {
                        const response = await fetch('/api/upload-ico/', {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken
                            },
                            body: formData
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            const linkText = `🔲 ${data.filename || file.name}`;
                            quill.insertText(insertIndex, linkText, 'link', data.url);
                            quill.insertText(insertIndex + linkText.length, '\n');
                            insertIndex += linkText.length + 1;
                            quill.setSelection(insertIndex);
                        } else {
                            alert('ICOファイルのアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                        }
                    } catch (error) {
                        alert('ICOファイルのアップロードに失敗しました');
                    }
                }
            }
        }
    }, false);
}

// 後方互換性のための個別関数（内部で統合関数を呼び出す）
export function addDragDropImageUpload(quill, isCreateModal, currentPageId) {
    addDragDropFileUpload(quill, isCreateModal, currentPageId);
}

export function addDragDropVideoUpload(quill, isCreateModal, currentPageId) {
    addDragDropFileUpload(quill, isCreateModal, currentPageId);
}

export function addDragDropExcelUpload(quill, isCreateModal, currentPageId) {
    addDragDropFileUpload(quill, isCreateModal, currentPageId);
}
