// キーボードショートカット
export function setupShortcuts(editor) {
    const editorEl = editor.editor;
    
    editorEl.addEventListener('keydown', (e) => {
        // Ctrl+K / Cmd+K でリンク
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'k') {
            e.preventDefault();
            
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            let url = 'https://';
            
            if (range.toString().trim()) {
                // 選択されたテキストがある場合
                url = prompt('リンクのURLを入力してください:', 'https://');
                if (url && url !== 'https://') {
                    const link = document.createElement('a');
                    link.href = url;
                    link.textContent = range.toString();
                    
                    range.deleteContents();
                    range.insertNode(link);
                    
                    editor.updatePlaceholder();
                }
            } else {
                // テキストが選択されていない場合
                url = prompt('リンクのURLを入力してください:', 'https://');
                if (url && url !== 'https://') {
                    const link = document.createElement('a');
                    link.href = url;
                    link.textContent = url;
                    
                    range.insertNode(link);
                    range.setStartAfter(link);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    editor.updatePlaceholder();
                }
            }
        }
        
        // Ctrl+Shift+; で文字を赤色に
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === ';' || e.key === ':' || e.code === 'Semicolon')) {
            e.preventDefault();
            
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const selectedText = range.toString().trim();
            
            if (selectedText) {
                const targetColor = '#ff0000';
                
                // 色が既に適用されているかチェック
                const hasColor = checkAndRemoveColor(range, targetColor);
                
                if (!hasColor) {
                    // 色を適用
                    const span = document.createElement('span');
                    span.style.color = targetColor;
                    const contents = range.extractContents();
                    span.appendChild(contents);
                    range.insertNode(span);
                    
                    // 選択範囲をspan要素全体に設定（選択を維持）
                    const newRange = document.createRange();
                    newRange.selectNodeContents(span);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
                
                editor.updatePlaceholder();
            }
        }
        
        // Ctrl+Shift+' で文字を青色に
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '\'' || e.key === '"' || e.code === 'Quote')) {
            e.preventDefault();
            
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const selectedText = range.toString().trim();
            
            if (selectedText) {
                const targetColor = '#0000ff';
                
                // 色が既に適用されているかチェック
                const hasColor = checkAndRemoveColor(range, targetColor);
                
                if (!hasColor) {
                    // 色を適用
                    const span = document.createElement('span');
                    span.style.color = targetColor;
                    const contents = range.extractContents();
                    span.appendChild(contents);
                    range.insertNode(span);
                    
                    // 選択範囲をspan要素全体に設定（選択を維持）
                    const newRange = document.createRange();
                    newRange.selectNodeContents(span);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
                
                editor.updatePlaceholder();
            }
        }
    });
    
    // URL自動リンク（簡易版）
    editorEl.addEventListener('input', () => {
        setTimeout(() => {
            autoLinkURLs(editorEl);
        }, 500);
    });
}

// 指定された色が適用されているかチェックし、適用されている場合は解除
function checkAndRemoveColor(range, targetColor) {
    const selectedText = range.toString().trim();
    if (!selectedText) return false;
    
    // 選択範囲のテキストを保存（正規化）
    const selectedTextContent = range.toString().trim();
    
    // 共通の親要素を取得
    let commonAncestor = range.commonAncestorContainer;
    
    // 共通の親要素自体がspan要素の場合
    if (commonAncestor.nodeType === Node.ELEMENT_NODE && 
        commonAncestor.tagName === 'SPAN' && 
        commonAncestor.style.color) {
        const spanColor = commonAncestor.style.color;
        const normalizedSpanColor = normalizeColorToHex(spanColor);
        const normalizedTarget = normalizeColorToHex(targetColor);
        
        if (normalizedSpanColor === normalizedTarget) {
            const spanText = commonAncestor.textContent.trim();
            if (spanText === selectedTextContent) {
                // このspan要素を削除
                const parent = commonAncestor.parentElement;
                if (parent) {
                    const fragment = document.createDocumentFragment();
                    while (commonAncestor.firstChild) {
                        fragment.appendChild(commonAncestor.firstChild);
                    }
                    
                    const nextSibling = commonAncestor.nextSibling;
                    if (nextSibling) {
                        parent.insertBefore(fragment, nextSibling);
                    } else {
                        parent.appendChild(fragment);
                    }
                    
                    commonAncestor.remove();
                    
                    // 選択範囲を復元
                    restoreSelection(parent, selectedTextContent);
                    return true;
                }
            }
        }
    }
    
    // テキストノードの場合は親要素を取得
    const ancestorElement = commonAncestor.nodeType === Node.TEXT_NODE 
        ? commonAncestor.parentElement 
        : commonAncestor;
    
    if (!ancestorElement) return false;
    
    // 開始ノードと終了ノードからspan要素を探す
    let foundColorSpan = null;
    
    // 開始ノードから親要素をたどってspan要素を探す
    let startNode = range.startContainer;
    let currentNode = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
    
    while (currentNode && currentNode !== ancestorElement && currentNode !== document.body) {
        if (currentNode.tagName === 'SPAN' && currentNode.style.color) {
            const spanColor = currentNode.style.color;
            const normalizedSpanColor = normalizeColorToHex(spanColor);
            const normalizedTarget = normalizeColorToHex(targetColor);
            
            if (normalizedSpanColor === normalizedTarget) {
                const spanText = currentNode.textContent.trim();
                if (spanText === selectedTextContent) {
                    foundColorSpan = currentNode;
                    break;
                }
            }
        }
        currentNode = currentNode.parentElement;
    }
    
    // 見つからない場合は、共通の親要素内のすべてのspan要素を検索
    if (!foundColorSpan) {
        const allSpans = Array.from(ancestorElement.querySelectorAll('span[style*="color"]'));
        
        for (let span of allSpans) {
            const spanColor = span.style.color;
            const normalizedSpanColor = normalizeColorToHex(spanColor);
            const normalizedTarget = normalizeColorToHex(targetColor);
            
            if (normalizedSpanColor === normalizedTarget) {
                const spanText = span.textContent.trim();
                
                // テキストが一致する、または選択範囲と交差する
                if (spanText === selectedTextContent || range.intersectsNode(span)) {
                    // span要素全体が選択されているか確認
                    try {
                        const spanRange = document.createRange();
                        spanRange.selectNodeContents(span);
                        const spanTextFromRange = spanRange.toString().trim();
                        
                        if (spanTextFromRange === selectedTextContent) {
                            foundColorSpan = span;
                            break;
                        }
                    } catch (err) {
                        // エラーが発生した場合でも、テキストが一致していれば使用
                        if (spanText === selectedTextContent) {
                            foundColorSpan = span;
                            break;
                        }
                    }
                }
            }
        }
    }
    
    if (foundColorSpan) {
        // 色を解除：span要素を削除して中身を展開
        const parent = foundColorSpan.parentElement;
        if (!parent) return true;
        
        // span要素のすべての子ノードを取り出す
        const fragment = document.createDocumentFragment();
        while (foundColorSpan.firstChild) {
            fragment.appendChild(foundColorSpan.firstChild);
        }
        
        // span要素を置き換え
        const nextSibling = foundColorSpan.nextSibling;
        if (nextSibling) {
            parent.insertBefore(fragment, nextSibling);
        } else {
            parent.appendChild(fragment);
        }
        
        foundColorSpan.remove();
        
        // 選択範囲を復元
        restoreSelection(parent, selectedTextContent);
        
        return true;
    }
    
    return false;
}

// 選択範囲を復元するヘルパー関数
function restoreSelection(parentElement, textContent) {
    setTimeout(() => {
        const selection = window.getSelection();
        try {
            const allText = parentElement.textContent || '';
            const startIndex = allText.indexOf(textContent);
            
            if (startIndex !== -1) {
                const walker = document.createTreeWalker(
                    parentElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                
                let textNode;
                let currentPos = 0;
                let startNode = null;
                let startPos = 0;
                
                // 開始位置を見つける
                while (textNode = walker.nextNode()) {
                    const nodeLength = textNode.textContent.length;
                    
                    if (currentPos + nodeLength > startIndex && !startNode) {
                        startNode = textNode;
                        startPos = startIndex - currentPos;
                        break;
                    }
                    
                    currentPos += nodeLength;
                }
                
                if (startNode) {
                    const newRange = document.createRange();
                    newRange.setStart(startNode, Math.min(startPos, startNode.textContent.length));
                    
                    // 終了位置を計算
                    let remainingLength = textContent.length;
                    let currentNode = startNode;
                    let currentOffset = startPos;
                    
                    while (remainingLength > 0 && currentNode) {
                        const available = currentNode.textContent.length - currentOffset;
                        
                        if (remainingLength <= available) {
                            newRange.setEnd(currentNode, currentOffset + remainingLength);
                            break;
                        } else {
                            remainingLength -= available;
                            currentNode = walker.nextNode();
                            currentOffset = 0;
                        }
                    }
                    
                    if (!newRange.collapsed) {
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
            }
        } catch (err) {
            console.warn('Error restoring selection:', err);
        }
    }, 10);
}

// 色をHEX形式に正規化
function normalizeColorToHex(color) {
    if (!color) return '';
    
    // 既にHEX形式の場合
    if (color.startsWith('#')) {
        return color.toLowerCase();
    }
    
    // RGB形式の場合
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16).padStart(2, '0');
            return hex;
        }).join('');
    }
    
    // その他の形式（名前など）はそのまま返す
    return color.toLowerCase();
}

function autoLinkURLs(editorEl) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        editorEl,
        NodeFilter.SHOW_TEXT,
        null
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.match(/https?:\/\/[^\s]+/)) {
            textNodes.push(node);
        }
    }
    
    textNodes.forEach(textNode => {
        const parent = textNode.parentElement;
        if (parent.tagName === 'A') return; // 既にリンクの場合はスキップ
        
        const text = textNode.textContent;
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const matches = [...text.matchAll(urlPattern)];
        
        if (matches.length > 0) {
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            
            matches.forEach(match => {
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                }
                
                const link = document.createElement('a');
                link.href = match[0];
                link.textContent = match[0];
                link.target = '_blank';
                fragment.appendChild(link);
                
                lastIndex = match.index + match[0].length;
            });
            
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            
            parent.replaceChild(fragment, textNode);
        }
    });
}