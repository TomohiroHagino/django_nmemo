// ドラッグ&ドロップアップロード
let dropHandler = null; // 既存のハンドラーを保持

export function setupDragDrop(editor, currentPageId, isCreateModal) {
    const editorEl = editor.editor;

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 既存のイベントリスナーを削除
    if (dropHandler) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            editorEl.removeEventListener(eventName, preventDefaults, false);
        });
        editorEl.removeEventListener('drop', dropHandler, false);
    }

    // 新しいハンドラーを作成
    dropHandler = async (e) => {
        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        // ページIDのチェックを改善
        const pageId = isCreateModal ? 'temp' : currentPageId;
        if (!isCreateModal && (!pageId || pageId === '')) {
            alert('ページIDが取得できません。ページを再読み込みしてください。');
            return; // 早期リターンで処理を停止
        }

        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        if (!csrfToken) {
            alert('CSRFトークンが見つかりません');
            return;
        }

        // ドロップ位置を取得
        let initialRange = getDropRange(editorEl, e);

        // 現在のカーソル位置を保持
        let currentRange = initialRange.cloneRange();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.type.startsWith('image/')) {
                const newRange = await uploadImage(file, pageId, csrfToken, editor, currentRange);
                if (newRange) {
                    currentRange = newRange; // 更新されたrangeを使用
                }
            } else if (file.type.startsWith('video/')) {
                const newRange = await uploadVideo(file, pageId, csrfToken, editor, currentRange);
                if (newRange) {
                    currentRange = newRange; // 更新されたrangeを使用
                }
            }
        }

        // 最後にカーソル位置を設定
        const finalSelection = window.getSelection();
        finalSelection.removeAllRanges();
        finalSelection.addRange(currentRange);
        
        // カーソルをエディタ内にフォーカス
        editorEl.focus();
    };

    // イベントリスナーを再登録
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editorEl.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        editorEl.addEventListener(eventName, () => {
            editorEl.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        editorEl.addEventListener(eventName, () => {
            editorEl.classList.remove('drag-over');
        }, false);
    });

    editorEl.addEventListener('drop', dropHandler, false);
}

// ドロップ位置から正確なRangeを取得する関数
function getDropRange(editorEl, e) {
    // まず caretRangeFromPoint を試す
    try {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && editorEl.contains(range.commonAncestorContainer)) {
            return range;
        }
    } catch (err) {
        // caretRangeFromPointが使えない場合は別の方法を試す
    }

    // エディタ要素内の相対位置を計算
    const rect = editorEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // エディタ要素内のすべてのテキストノードを走査して、ドロップ位置に最も近い位置を見つける
    const walker = document.createTreeWalker(
        editorEl,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        null,
        false
    );

    let node;
    let bestNode = null;
    let bestOffset = 0;
    let minDistance = Infinity;

    // 既存の選択範囲がある場合はそれを使用
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const existingRange = selection.getRangeAt(0);
        if (editorEl.contains(existingRange.commonAncestorContainer)) {
            return existingRange.cloneRange();
        }
    }

    // テキストノードを走査して最も近い位置を見つける
    while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.length > 0) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = range.getClientRects();
            
            for (let i = 0; i < rects.length; i++) {
                const nodeRect = rects[i];
                const distance = Math.abs(nodeRect.top - (rect.top + y)) + Math.abs(nodeRect.left - (rect.left + x));
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestNode = node;
                    // テキストノード内の正確なオフセットを計算
                    const textRange = document.createRange();
                    textRange.selectNodeContents(node);
                    const textRects = textRange.getClientRects();
                    
                    if (textRects.length > 0) {
                        // 簡易的なオフセット計算（改善の余地あり）
                        bestOffset = Math.min(
                            Math.floor((x / textRects[0].width) * node.textContent.length),
                            node.textContent.length
                        );
                    }
                }
            }
        }
    }

    // 見つかった位置にRangeを作成
    if (bestNode) {
        const range = document.createRange();
        range.setStart(bestNode, bestOffset);
        range.collapse(true);
        return range;
    }

    // フォールバック: エディタの最後に挿入
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    return range;
}

async function uploadImage(file, pageId, csrfToken, editor, range) {
    if (file.size > 5 * 1024 * 1024) {
        alert(`ファイル "${file.name}" のサイズは5MB以下にしてください`);
        return null;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('page_id', pageId);

    try {
        const response = await fetch('/api/upload-image/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            const img = document.createElement('img');
            img.src = data.url;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'inline-block'; // インライン要素として表示
            img.style.verticalAlign = 'middle'; // テキストとの配置を調整

            // rangeが有効か確認し、エディタ要素内にあることを確認
            if (!range || !editor.editor.contains(range.commonAncestorContainer)) {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);
                    if (!editor.editor.contains(range.commonAncestorContainer)) {
                        range = document.createRange();
                        range.selectNodeContents(editor.editor);
                        range.collapse(false);
                    }
                } else {
                    range = document.createRange();
                    range.selectNodeContents(editor.editor);
                    range.collapse(false);
                }
            }

            // 画像を挿入（選択範囲は削除しない）
            const clonedRange = range.cloneRange();
            clonedRange.insertNode(img);
            
            // 画像の後に改行を追加（オプション）
            // const br = document.createElement('br');
            // img.parentNode.insertBefore(br, img.nextSibling);
            
            // 新しいrangeを作成して画像の後にカーソルを置く
            const newRange = document.createRange();
            newRange.setStartAfter(img);
            newRange.collapse(true);
            
            // 選択範囲を更新
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);

            editor.updatePlaceholder();
            
            // 更新されたrangeを返す
            return newRange;
        } else {
            alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
            return null;
        }
    } catch (error) {
        alert('画像のアップロードに失敗しました');
        return null;
    }
}

async function uploadVideo(file, pageId, csrfToken, editor, range) {
    if (file.size > 250 * 1024 * 1024) {
        alert(`ファイル "${file.name}" のサイズは250MB以下にしてください`);
        return null;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('page_id', pageId);

    try {
        const response = await fetch('/api/upload-video/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            const video = document.createElement('video');
            video.src = data.url;
            video.controls = true;
            video.style.maxWidth = '100%';
            video.style.height = 'auto';

            // rangeが有効か確認し、エディタ要素内にあることを確認
            if (!range || !editor.editor.contains(range.commonAncestorContainer)) {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);
                    if (!editor.editor.contains(range.commonAncestorContainer)) {
                        range = document.createRange();
                        range.selectNodeContents(editor.editor);
                        range.collapse(false);
                    }
                } else {
                    range = document.createRange();
                    range.selectNodeContents(editor.editor);
                    range.collapse(false);
                }
            }

            // 動画を挿入（選択範囲は削除しない）
            const clonedRange = range.cloneRange();
            clonedRange.insertNode(video);
            
            // 新しいrangeを作成して動画の後にカーソルを置く
            const newRange = document.createRange();
            newRange.setStartAfter(video);
            newRange.collapse(true);
            
            // 選択範囲を更新
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);

            editor.updatePlaceholder();
            
            // 更新されたrangeを返す
            return newRange;
        } else {
            alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
            return null;
        }
    } catch (error) {
        alert('動画のアップロードに失敗しました');
        return null;
    }
}
