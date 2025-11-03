// スタイル付きコピペ処理（既存のclipboard-formatter.jsから改善）
export function setupStylePreservingClipboard(editor) {
    // コピーイベントの処理（画像をコピーできるようにする）
    editor.editor.addEventListener('copy', function(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            // 選択範囲がない場合はデフォルト動作に任せる
            return;
        }

        const range = selection.getRangeAt(0);
        
        // エディター要素内の選択のみを処理
        if (!editor.editor.contains(range.commonAncestorContainer)) {
            // エディター外の選択はデフォルト動作に任せる
            return;
        }
        
        // 選択範囲の内容を取得
        const clonedContents = range.cloneContents();
        
        // 選択範囲内の画像をチェック
        const tempContainer = document.createElement('div');
        tempContainer.appendChild(clonedContents.cloneNode(true));
        const imagesInSelection = tempContainer.querySelectorAll('img');
        
        // 選択範囲が画像のみかどうかをチェック
        // 画像のみが選択されている場合（画像要素自体が選択範囲全体）のみ特別処理
        let isImageOnlySelection = false;
        if (imagesInSelection.length > 0) {
            const selectedNode = range.commonAncestorContainer;
            
            // 画像要素自体が選択範囲の共通祖先である場合、または
            // 選択範囲が単一の画像要素のみを含む場合
            if (selectedNode.nodeType === Node.ELEMENT_NODE && selectedNode.tagName === 'IMG') {
                isImageOnlySelection = true;
            } else {
                // 選択範囲内にテキストがあるかチェック
                const textContent = tempContainer.textContent.trim();
                // 画像以外にコンテンツがない場合（テキストがなく、画像のみ）
                // ただし、複数の要素がある場合は通常のコピーにする
                if (!textContent && imagesInSelection.length === 1 && tempContainer.children.length === 1) {
                    isImageOnlySelection = true;
                }
            }
        }

        // 画像のみが選択されている場合のみ、画像専用の処理を行う
        if (isImageOnlySelection && imagesInSelection.length === 1) {
            const img = imagesInSelection[0];
            e.preventDefault();
            e.stopPropagation();

            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;

            try {
                // HTMLとして画像をコピー
                const imgClone = img.cloneNode(true);
                const html = imgClone.outerHTML;
                clipboardData.setData('text/html', html);
                clipboardData.setData('text/plain', img.src); // プレーンテキストとしてURLを設定

                // 画像データをblobとして取得してクリップボードに設定
                copyImageToClipboard(img, clipboardData).catch(err => {
                    console.warn('画像データのコピーに失敗しました（HTMLのみコピーされます）:', err);
                });
            } catch (err) {
                console.error('画像のコピー処理でエラー:', err);
                // エラー時はデフォルト動作に任せる
            }
        } else {
            // テキストと画像が混在する場合や、テキストのみの場合
            // スタイル付きHTMLを生成してコピー
            e.preventDefault();
            e.stopPropagation();

            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;

            try {
                // 選択範囲をHTMLとして取得し、スタイルを保持
                const html = prepareHTMLForCopy(clonedContents, editor.editor);
                const plainText = selection.toString();

                clipboardData.setData('text/html', html);
                clipboardData.setData('text/plain', plainText);
            } catch (err) {
                console.error('コピー処理でエラー:', err);
                // エラー時はプレーンテキストのみコピー
                clipboardData.setData('text/plain', selection.toString());
            }
        }
    }, true);
}

// 画像をクリップボードにコピーする関数
async function copyImageToClipboard(img, clipboardData) {
    try {
        // Canvas APIを使って画像をblobとして取得
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 画像が読み込まれるまで待つ
        await new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous'; // CORS対応
            
            image.onload = () => {
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
                resolve();
            };
            
            image.onerror = reject;
            image.src = img.src;
        });

        // Canvasからblobを取得
        canvas.toBlob((blob) => {
            if (blob && clipboardData instanceof ClipboardEvent) {
                // Clipboard APIを使用（モダンブラウザ）
                if (navigator.clipboard && navigator.clipboard.write) {
                    const clipboardItem = new ClipboardItem({ [blob.type]: blob });
                    navigator.clipboard.write([clipboardItem]).catch(err => {
                        console.warn('Clipboard APIでの画像コピーに失敗:', err);
                    });
                }
            }
        }, 'image/png');
    } catch (err) {
        // CORSエラーなどの場合はHTMLコピーのみで続行
        console.warn('画像データの取得に失敗:', err);
    }
}

// コピー用にHTMLを準備する関数（レイアウトを保持しつつ、フォーム内に収まるように調整）
function prepareHTMLForCopy(clonedContents, editorElement) {
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(clonedContents.cloneNode(true));
    
    // エディターの実際の幅を取得（制約を考慮）
    const editorRect = editorElement.getBoundingClientRect();
    const editorWidth = editorRect.width;
    
    // すべての要素を処理
    function processElementForCopy(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        const tagName = node.tagName ? node.tagName.toUpperCase() : '';
        
        // 画像の処理
        if (tagName === 'IMG') {
            // 元のサイズを保持（max-width制約を解除）
            const computedStyle = window.getComputedStyle(node);
            const actualWidth = node.getBoundingClientRect().width;
            const actualHeight = node.getBoundingClientRect().height;
            
            // 元の幅がある場合は保持
            if (actualWidth > 0) {
                node.style.maxWidth = 'none';
                node.style.width = actualWidth + 'px';
                node.style.height = actualHeight + 'px';
            }
        }
        // テーブルの処理
        else if (tagName === 'TABLE') {
            const computedStyle = window.getComputedStyle(node);
            const actualWidth = node.getBoundingClientRect().width;
            
            // テーブルがエディター幅を超えている場合は元の幅を保持
            if (actualWidth >= editorWidth * 0.9) {
                // 元の幅を保持（コンテンツに応じた幅）
                node.style.maxWidth = 'none';
                node.style.width = 'auto';
                node.style.tableLayout = 'auto';
            } else {
                // 小さいテーブルは幅を保持
                node.style.width = actualWidth + 'px';
                node.style.maxWidth = 'none';
            }
        }
        // iframeの処理
        else if (tagName === 'IFRAME') {
            const computedStyle = window.getComputedStyle(node);
            const actualWidth = node.getBoundingClientRect().width;
            const actualHeight = node.getBoundingClientRect().height;
            
            // 元のサイズを保持
            if (actualWidth > 0 && actualHeight > 0) {
                node.style.maxWidth = 'none';
                node.style.width = actualWidth + 'px';
                node.style.height = actualHeight + 'px';
            }
        }
        // div/p要素の処理
        else if (tagName === 'DIV' || tagName === 'P') {
            // max-width制約を解除して、コンテンツに応じた幅にする
            const computedStyle = window.getComputedStyle(node);
            const hasFixedWidth = node.style.width || computedStyle.width !== 'auto';
            
            if (!hasFixedWidth) {
                // 固定幅がない場合は、max-width制約のみ解除
                node.style.maxWidth = 'none';
            }
        }
        
        // スタイルをインライン化して保持
        inlineStylesForCopy(node);
        
        // 子要素を再帰的に処理
        Array.from(node.childNodes).forEach(child => {
            processElementForCopy(child);
        });
    }
    
    // ルート要素から処理
    Array.from(tempContainer.childNodes).forEach(child => {
        processElementForCopy(child);
    });
    
    return tempContainer.innerHTML;
}

// 要素のスタイルをインライン化してコピー用に準備
function inlineStylesForCopy(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    
    const tagName = node.tagName ? node.tagName.toUpperCase() : '';
    const skipElements = ['BR', 'HR', 'WBR', 'INPUT', 'META', 'LINK', 'BASE'];
    
    if (skipElements.includes(tagName)) return;
    
    // classとidを削除（外部CSSに依存しないように）
    node.removeAttribute('class');
    node.removeAttribute('id');
    
    // 既存のインラインスタイルを取得
    const existingStyle = node.getAttribute('style') || '';
    const existingStyles = {};
    
    // 既存のスタイルをパース
    if (existingStyle) {
        existingStyle.split(';').forEach(style => {
            const [prop, value] = style.split(':').map(s => s.trim());
            if (prop && value) {
                existingStyles[prop] = value;
            }
        });
    }
    
    // 計算されたスタイルを取得して重要なものを追加
    try {
        const computedStyle = window.getComputedStyle(node);
        const importantProps = [
            'color', 'background-color', 'background',
            'font-size', 'font-weight', 'font-style', 'font-family',
            'text-decoration', 'text-align',
            'border', 'border-color', 'border-width', 'border-style',
            'padding', 'margin', 'vertical-align', 'line-height'
        ];
        
        if (tagName === 'TABLE' || tagName === 'TD' || tagName === 'TH' || tagName === 'TR') {
            importantProps.push('width', 'height', 'border-collapse', 'border-spacing', 'table-layout');
        }
        
        importantProps.forEach(prop => {
            // 既存スタイルがない場合のみ追加
            if (!existingStyles[prop]) {
                try {
                    const value = computedStyle.getPropertyValue(prop);
                    if (value && value.trim() && 
                        value !== 'none' && 
                        value !== 'rgba(0, 0, 0, 0)' && 
                        value !== 'transparent' &&
                        value !== 'normal' &&
                        !value.startsWith('0px') &&
                        value !== 'auto') {
                        existingStyles[prop] = value;
                    }
                } catch (err) {
                    // 無視
                }
            }
        });
        
        // スタイルを文字列に変換
        const styleString = Object.entries(existingStyles)
            .map(([prop, value]) => `${prop}: ${value}`)
            .join('; ');
        
        if (styleString) {
            node.setAttribute('style', styleString);
        }
    } catch (err) {
        // エラー時は既存スタイルのみ保持
    }
}

// 画像ファイルのペースト処理
async function handleImageFilePaste(file, editor, e) {
    const editorEl = editor.editor;
    const pageId = editorEl.dataset.pageId || null;
    const isCreateModal = editorEl.dataset.isCreateModal === 'true';
    
    // ドラッグ&ドロップのuploadImage関数をインポートして使用
    // drag-drop.jsのuploadImageを直接呼び出す
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (!csrfToken) {
        alert('CSRFトークンが見つかりません');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert(`ファイル "${file.name}" のサイズは5MB以下にしてください`);
        return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('page_id', isCreateModal ? 'temp' : (pageId || ''));

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
            img.style.display = 'inline-block';
            img.style.verticalAlign = 'middle';

            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                range.setStartAfter(img);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            editor.updatePlaceholder();
        } else {
            alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
        }
    } catch (error) {
        console.error('画像のアップロードエラー:', error);
        alert('画像のアップロードに失敗しました');
    }
}

  // すべてのスタイルをインライン化
function inlineAllStyles(element) {
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.visibility = 'hidden';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    try {
        // 要素をクローンして追加
        const cloned = element.cloneNode(true);
        tempContainer.appendChild(cloned);

        // すべての要素に対してスタイルを抽出
        function processElement(node) {
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const tagName = node.tagName ? node.tagName.toUpperCase() : '';
            const skipStyleElements = ['BR', 'HR', 'WBR', 'INPUT', 'META', 'LINK', 'BASE'];
            
            if (skipStyleElements.includes(tagName)) return;

            // class属性とid属性を削除
            node.removeAttribute('class');
            node.removeAttribute('id');

            // コンテンツチェック
            const hasContent = hasNonWhitespaceContent(node);
            const isStructuralElement = ['TABLE', 'TR', 'TD', 'TH', 'TBODY', 'THEAD', 'TFOOT', 
                                        'IMG', 'VIDEO', 'P', 'DIV', 'SPAN'].includes(tagName);

            if (!hasContent && !isStructuralElement) {
                // 子要素のみ処理
                Array.from(node.childNodes).forEach(child => processElement(child));
                return;
            }

            // 既存のインラインスタイル
            const existingStyle = node.getAttribute('style') || '';
            
            // 既存スタイルがある場合は最小限の処理のみ
            if (existingStyle && existingStyle.trim()) {
                // テーブル要素の属性を保持
                if (tagName === 'TABLE' || tagName === 'TD' || tagName === 'TH') {
                    preserveTableAttributes(node, tagName);
                }
                Array.from(node.childNodes).forEach(child => processElement(child));
                return;
            }

            // computedStyleからスタイルを取得
            try {
                const computedStyle = window.getComputedStyle(node);
                const styles = [];
                
                const importantProps = [
                    'color', 'background-color', 'background',
                    'font-size', 'font-weight', 'font-style', 'font-family',
                    'text-decoration', 'text-align',
                    'border', 'border-color', 'border-width', 'border-style',
                    'padding', 'margin', 'vertical-align'
                ];

                if (tagName === 'TABLE' || tagName === 'TD' || tagName === 'TH' || tagName === 'TR') {
                    importantProps.push('width', 'height', 'border-collapse', 'border-spacing');
                }

                importantProps.forEach(prop => {
                    try {
                        const value = computedStyle.getPropertyValue(prop);
                        if (value && value.trim() && 
                            value !== 'none' && 
                            value !== 'rgba(0, 0, 0, 0)' && 
                            value !== 'transparent' &&
                            value !== 'normal' &&
                            !value.startsWith('0px')) {
                            styles.push(`${prop}: ${value}`);
                        }
                    } catch (err) {
                        // 無視
                    }
                });

                if (styles.length > 0) {
                    node.setAttribute('style', styles.join('; '));
                }

                // テーブル要素の属性を保持
                preserveTableAttributes(node, tagName);
            } catch (err) {
                console.warn('Error processing element styles:', err);
            }

            // 子要素を処理
            Array.from(node.childNodes).forEach(child => {
                processElement(child);
            });
        }

        processElement(cloned);

        // 処理済みの要素を元に戻す
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        while (cloned.firstChild) {
            element.appendChild(cloned.firstChild);
        }
    } finally {
        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }
    }
}

function hasNonWhitespaceContent(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim().length > 0;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName ? node.tagName.toUpperCase() : '';
        if (['TABLE', 'IMG', 'VIDEO', 'BR', 'HR'].includes(tagName)) {
            return true;
        }
        
        for (const child of node.childNodes) {
            if (hasNonWhitespaceContent(child)) {
                return true;
            }
        }
    }
    
    return false;
}

function preserveTableAttributes(node, tagName) {
    if (tagName === 'TABLE') {
        ['border', 'cellpadding', 'cellspacing', 'width', 'height'].forEach(attr => {
            const value = node.getAttribute(attr);
            if (value !== null) {
                node.setAttribute(attr, value);
            }
        });
    }
    
    if (tagName === 'TD' || tagName === 'TH') {
        ['colspan', 'rowspan', 'width', 'height'].forEach(attr => {
            const value = node.getAttribute(attr);
            if (value) {
                node.setAttribute(attr, value);
            }
        });
    }
}
