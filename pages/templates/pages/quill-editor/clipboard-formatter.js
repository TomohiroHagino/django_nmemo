// Quillのクリップボードモジュールを拡張して、スタイル付きHTMLを保持する
// HTMLをそのまま保持する方式
export function setupStylePreservingClipboard(quill) {
    // 要素が実際にテキストコンテンツを持っているかチェック（空白のみは除外）
    function hasNonWhitespaceContent(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent.trim().length > 0;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            // テーブルや画像などの構造要素は常に有効
            const tagName = node.tagName ? node.tagName.toUpperCase() : '';
            if (['TABLE', 'IMG', 'VIDEO', 'BR', 'HR'].includes(tagName)) {
                return true;
            }
            
            // テキストノードを直接チェック（再帰を避ける）
            for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
                    return true;
                }
                // 構造要素がある場合は有効
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const childTag = child.tagName ? child.tagName.toUpperCase() : '';
                    if (['TABLE', 'IMG', 'VIDEO', 'BR', 'HR'].includes(childTag)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    // すべてのスタイルをインラインスタイルとして抽出する関数（最適化版）
    function extractAllStyles(element, rootElement) {
        // 要素を一時的にDOMに追加してcomputedStyleを取得
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);
        
        try {
            // 要素をクローンして追加
            const cloned = element.cloneNode(true);
            tempContainer.appendChild(cloned);
            
            // スタイル抽出のキャッシュ（同じ要素タイプで再利用）
            const styleCache = new Map();
            
            // すべての要素に対してスタイルを抽出
            function processElement(node) {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }
                
                try {
                    const tagName = node.tagName ? node.tagName.toUpperCase() : '';
                    
                    // スタイルを適用すべきでない要素（自己完結型要素など）
                    const skipStyleElements = ['BR', 'HR', 'WBR', 'INPUT', 'META', 'LINK', 'BASE'];
                    if (skipStyleElements.includes(tagName)) {
                        // 子要素も処理しない（これらの要素は子要素を持たない）
                        return;
                    }
                    
                    // 要素が実際にテキストコンテンツを持っているかチェック（軽量化）
                    const hasContent = hasNonWhitespaceContent(node);
                    
                    // テーブル関連要素や構造要素は常に処理
                    const isStructuralElement = ['TABLE', 'TR', 'TD', 'TH', 'TBODY', 'THEAD', 'TFOOT', 
                                                'IMG', 'VIDEO', 'P', 'DIV', 'SPAN'].includes(tagName);
                    
                    // コンテンツがない場合、かつ構造要素でない場合はスタイルを適用しない
                    if (!hasContent && !isStructuralElement) {
                        // 子要素のみ処理（スタイルは適用しない）
                        const children = Array.from(node.childNodes);
                        for (let i = 0; i < children.length; i++) {
                            processElement(children[i]);
                        }
                        return;
                    }
                    
                    // class属性とid属性を削除
                    node.removeAttribute('class');
                    node.removeAttribute('id');
                    
                    // 既存のインラインスタイルを取得
                    const existingStyle = node.getAttribute('style') || '';
                    
                    // 既存スタイルがある場合は、それを使用して新しいスタイルを追加する必要は最小限に
                    if (existingStyle) {
                        // 既存スタイルがある場合は、computedStyleは呼ばない（パフォーマンス向上）
                        // ただし、テーブル要素の場合は必要なスタイルを追加
                        if (isStructuralElement && (tagName === 'TABLE' || tagName === 'TD' || tagName === 'TH' || tagName === 'TR')) {
                            // テーブル関連要素の属性を保持
                            if (tagName === 'TABLE') {
                                const border = node.getAttribute('border');
                                const cellpadding = node.getAttribute('cellpadding');
                                const cellspacing = node.getAttribute('cellspacing');
                                const width = node.getAttribute('width');
                                const height = node.getAttribute('height');
                                
                                if (border !== null) node.setAttribute('border', border);
                                if (cellpadding !== null) node.setAttribute('cellpadding', cellpadding);
                                if (cellspacing !== null) node.setAttribute('cellspacing', cellspacing);
                                if (width) node.setAttribute('width', width);
                                if (height) node.setAttribute('height', height);
                            }
                            
                            if (tagName === 'TD' || tagName === 'TH') {
                                const colspan = node.getAttribute('colspan');
                                const rowspan = node.getAttribute('rowspan');
                                const width = node.getAttribute('width');
                                const height = node.getAttribute('height');
                                
                                if (colspan) node.setAttribute('colspan', colspan);
                                if (rowspan) node.setAttribute('rowspan', rowspan);
                                if (width) node.setAttribute('width', width);
                                if (height) node.setAttribute('height', height);
                            }
                        }
                        
                        // 既存スタイルがある場合はそのまま保持
                        // 子要素のみ処理
                        const children = Array.from(node.childNodes);
                        for (let i = 0; i < children.length; i++) {
                            processElement(children[i]);
                        }
                        return;
                    }
                    
                    // 既存スタイルがない場合のみ、computedStyleから取得
                    try {
                        const computedStyle = window.getComputedStyle(node);
                        const styleProps = [];
                        const importantStyles = [
                            'color', 'background-color', 'background',
                            'font-size', 'font-weight', 'font-style', 'font-family',
                            'text-decoration', 'text-align',
                            'border', 'border-color', 'border-width', 'border-style',
                            'padding', 'margin', 'vertical-align'
                        ];
                        
                        // テーブル関連要素には追加のスタイル
                        if (tagName === 'TABLE' || tagName === 'TD' || tagName === 'TH' || tagName === 'TR') {
                            importantStyles.push('width', 'height', 'border-collapse', 'border-spacing');
                        }
                        
                        // 重要なスタイルのみを取得
                        for (let i = 0; i < importantStyles.length; i++) {
                            const prop = importantStyles[i];
                            try {
                                const value = computedStyle.getPropertyValue(prop);
                                if (value && value.trim() && 
                                    value !== 'none' && 
                                    value !== 'rgba(0, 0, 0, 0)' && 
                                    value !== 'transparent' &&
                                    value !== 'normal' &&
                                    !value.startsWith('0px')) {
                                    styleProps.push(`${prop}: ${value}`);
                                }
                            } catch (err) {
                                // 無視
                            }
                        }
                        
                        if (styleProps.length > 0) {
                            node.setAttribute('style', styleProps.join('; '));
                        }
                        
                        // テーブル関連要素の属性を保持
                        if (tagName === 'TABLE') {
                            const border = node.getAttribute('border');
                            const cellpadding = node.getAttribute('cellpadding');
                            const cellspacing = node.getAttribute('cellspacing');
                            const width = node.getAttribute('width');
                            const height = node.getAttribute('height');
                            
                            if (border !== null) node.setAttribute('border', border);
                            if (cellpadding !== null) node.setAttribute('cellpadding', cellpadding);
                            if (cellspacing !== null) node.setAttribute('cellspacing', cellspacing);
                            if (width) node.setAttribute('width', width);
                            if (height) node.setAttribute('height', height);
                        }
                        
                        if (tagName === 'TD' || tagName === 'TH') {
                            const colspan = node.getAttribute('colspan');
                            const rowspan = node.getAttribute('rowspan');
                            const width = node.getAttribute('width');
                            const height = node.getAttribute('height');
                            
                            if (colspan) node.setAttribute('colspan', colspan);
                            if (rowspan) node.setAttribute('rowspan', rowspan);
                            if (width) node.setAttribute('width', width);
                            if (height) node.setAttribute('height', height);
                        }
                    } catch (err) {
                        console.warn('Error processing element styles:', err);
                    }
                    
                    // 子要素を処理
                    const children = Array.from(node.childNodes);
                    for (let i = 0; i < children.length; i++) {
                        processElement(children[i]);
                    }
                } catch (err) {
                    console.warn('Error processing element:', err);
                }
            }
            
            processElement(cloned);
            
            // 処理済みのクローンを返す
            const result = cloned.cloneNode(true);
            return result;
            
        } finally {
            // 一時コンテナを削除
            if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
        }
    }

    // pasteイベントを直接ハンドルしてHTMLをそのまま挿入
    quill.root.addEventListener('paste', function(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const html = clipboardData.getData('text/html');
        if (!html || !html.trim()) return;

        // HTMLをそのまま保持するため、Quillの標準処理を無効化
        e.preventDefault();
        e.stopPropagation();

        const selection = quill.getSelection(true);
        if (!selection) return;

        try {
            // HTMLをパース
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html.trim();
            
            if (!tempDiv.hasChildNodes()) {
                // HTMLがない場合はプレーンテキストを挿入
                const text = clipboardData.getData('text/plain');
                if (text) {
                    quill.insertText(selection.index, text, 'user');
                }
                return;
            }

            // テーブルが含まれているかチェック（ルートレベルでも子要素でも）
            const tables = tempDiv.querySelectorAll('table');
            const directTableNodes = Array.from(tempDiv.childNodes).filter(node => 
                node.nodeType === Node.ELEMENT_NODE && 
                node.tagName && 
                node.tagName.toUpperCase() === 'TABLE'
            );
            
            const hasTable = tables.length > 0 || directTableNodes.length > 0;

            // 選択範囲を削除
            if (selection.length > 0) {
                quill.deleteText(selection.index, selection.length, 'user');
                // 削除後の選択位置を更新
                const updatedSelection = quill.getSelection(true);
                if (updatedSelection) {
                    selection.index = updatedSelection.index;
                }
            }

            // Quillのrootを取得
            const root = quill.root;
            
            // すべてのスタイルを抽出したHTMLを作成
            const processedNodes = [];
            const children = Array.from(tempDiv.childNodes);
            
            children.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    // テキストノードは空白のみでない場合のみ保持
                    if (child.textContent.trim().length > 0) {
                        processedNodes.push(child.cloneNode());
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    // tagNameは大文字で返される
                    const tagName = child.tagName ? child.tagName.toUpperCase() : '';
                    
                    // テーブルまたはテーブルを含む要素の場合は特別な処理
                    if (tagName === 'TABLE' || child.querySelector('table')) {
                        // テーブルをラッパーdivで囲む（Quillが認識しやすいように）
                        const wrapper = document.createElement('div');
                        wrapper.className = 'ql-table-wrapper';
                        wrapper.setAttribute('contenteditable', 'false');
                        wrapper.style.margin = '10px 0';
                        wrapper.style.width = '100%';
                        wrapper.style.overflowX = 'auto';
                        
                        // テーブル要素を処理（スタイルを抽出）
                        const processed = extractAllStyles(child, tempDiv);
                        
                        // テーブルが正しく処理されているか確認
                        if (processed) {
                            wrapper.appendChild(processed);
                            processedNodes.push(wrapper);
                        } else {
                            // extractAllStylesが失敗した場合でも、元の要素を使用
                            const cloned = child.cloneNode(true);
                            wrapper.appendChild(cloned);
                            processedNodes.push(wrapper);
                        }
                    } else {
                        // 通常の要素ノードはスタイルを抽出
                        // ただし、コンテンツがない場合は処理しない
                        if (hasNonWhitespaceContent(child)) {
                            const processed = extractAllStyles(child, tempDiv);
                            if (processed) {
                                processedNodes.push(processed);
                            }
                        }
                    }
                }
            });

            // 処理済みノードを挿入
            if (processedNodes.length > 0) {
                // テーブルが含まれているか確認
                const hasTableInNodes = processedNodes.some(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return node.querySelector('table') !== null || 
                               (node.tagName && node.tagName.toUpperCase() === 'TABLE') ||
                               (node.classList && node.classList.contains('ql-table-wrapper'));
                    }
                    return false;
                });

                // テーブルがある場合は特別な処理
                if (hasTableInNodes) {
                    // 選択位置を取得
                    const range = quill.getSelection(true);
                    if (!range) return;
                    
                    // 挿入するHTMLを作成
                    const nodesHTML = processedNodes.map(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            return node.textContent;
                        } else {
                            return node.outerHTML;
                        }
                    }).join('');
                    
                    // 選択位置に対応するテキスト位置を見つける
                    let textOffset = 0;
                    const walker = document.createTreeWalker(
                        root,
                        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                        null
                    );
                    
                    let node;
                    let foundPosition = false;
                    while (node = walker.nextNode()) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            if (textOffset + node.textContent.length >= range.index) {
                                // このテキストノード内に位置がある
                                const splitOffset = range.index - textOffset;
                                const before = node.textContent.substring(0, splitOffset);
                                const after = node.textContent.substring(splitOffset);
                                
                                // テキストノードを分割してHTMLを挿入
                                const parent = node.parentNode;
                                if (parent) {
                                    const beforeNode = document.createTextNode(before);
                                    const afterNode = document.createTextNode(after);
                                    
                                    // HTMLを文字列として挿入
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = nodesHTML;
                                    const nodesToInsert = Array.from(tempDiv.childNodes);
                                    
                                    parent.insertBefore(beforeNode, node);
                                    nodesToInsert.forEach(n => {
                                        parent.insertBefore(n, node);
                                    });
                                    parent.insertBefore(afterNode, node);
                                    parent.removeChild(node);
                                }
                                foundPosition = true;
                                break;
                            }
                            textOffset += node.textContent.length;
                        }
                    }
                    
                    if (!foundPosition) {
                        // 位置が見つからない場合は最後に追加
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = nodesHTML;
                        const nodesToInsert = Array.from(tempDiv.childNodes);
                        nodesToInsert.forEach(n => {
                            root.appendChild(n);
                        });
                    }
                    
                    // プレースホルダーを更新し、Quillに変更を通知
                    setTimeout(() => {
                        try {
                            // プレースホルダーの表示/非表示を更新
                            const hasContent = root.textContent.trim().length > 0 || 
                                             root.querySelector('table, img, video, .ql-table-wrapper');
                            
                            if (hasContent) {
                                root.classList.remove('ql-blank');
                            }
                            
                            // カーソル位置を更新
                            const newIndex = range.index + nodesHTML.length;
                            quill.setSelection(newIndex, 0, 'silent');
                            
                        } catch (err) {
                            console.warn('Error updating Quill state:', err);
                        }
                    }, 10);
                    
                    return; // テーブルがある場合はここで終了
                }

                // テーブルがない場合の通常処理（既存のコード）
                const range = quill.getSelection(true);
                if (!range) {
                    console.warn('No selection range available');
                    return;
                }

                // 選択位置に対応するDOMノードを見つける
                const rootChildren = Array.from(root.childNodes);
                let currentOffset = 0;
                let targetNode = null;
                let targetOffset = 0;
                
                for (let i = 0; i < rootChildren.length; i++) {
                    const node = rootChildren[i];
                    const nodeLength = node.nodeType === Node.TEXT_NODE ? 
                        node.textContent.length : 
                        (node.textContent || '').length + 1;
                    
                    if (currentOffset + nodeLength >= range.index) {
                        targetNode = node;
                        targetOffset = range.index - currentOffset;
                        break;
                    }
                    
                    currentOffset += nodeLength;
                }

                if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
                    // テキストノードの場合は分割して挿入
                    const textNode = targetNode;
                    const text = textNode.textContent;
                    const beforeText = text.substring(0, targetOffset);
                    const afterText = text.substring(targetOffset);
                    
                    const beforeNode = document.createTextNode(beforeText);
                    const afterNode = document.createTextNode(afterText);
                    
                    const parent = textNode.parentNode;
                    if (parent) {
                        parent.insertBefore(beforeNode, textNode);
                        processedNodes.forEach(node => {
                            parent.insertBefore(node, textNode);
                        });
                        parent.insertBefore(afterNode, textNode);
                        parent.removeChild(textNode);
                    }
                } else {
                    // ブロック要素の場合は、その前または後に挿入
                    const fragment = document.createDocumentFragment();
                    processedNodes.forEach(node => {
                        fragment.appendChild(node);
                    });
                    
                    if (targetNode) {
                        root.insertBefore(fragment, targetNode);
                    } else {
                        root.appendChild(fragment);
                    }
                }

                // カーソル位置を更新（テーブルがある場合はupdateを呼ばない）
                setTimeout(() => {
                    let newIndex = range.index;
                    processedNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            newIndex += node.textContent.length;
                        } else {
                            const textLength = (node.textContent || '').length;
                            newIndex += textLength > 0 ? textLength + 1 : 1;
                        }
                    });
                    
                    try {
                        quill.setSelection(newIndex, 0, 'user');
                        // テーブルがある場合はupdateを呼ばない（Quillがテーブルを削除するのを防ぐ）
                        if (!hasTableInNodes) {
                            quill.update('user');
                        }
                    } catch (err) {
                        console.warn('Error updating selection:', err);
                    }
                }, 10);
            } else {
                console.warn('No processed nodes to insert');
            }

        } catch (error) {
            console.warn('Error pasting HTML:', error);
            console.error(error);
            // エラー時はプレーンテキストをフォールバック
            const text = clipboardData.getData('text/plain');
            if (text) {
                quill.insertText(selection.index, text, 'user');
            }
        }
    }, true); // capture phaseで実行
}
