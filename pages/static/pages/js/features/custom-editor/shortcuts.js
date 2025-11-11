// キーボードショートカット

// 定数定義
const DEFAULT_LINK_URL = 'https://';
const COLOR_RED = '#ff0000';
const COLOR_BLUE = '#0000ff';
const AUTO_LINK_DELAY_MS = 500;
const SELECTION_RESTORE_DELAY_MS = 10;

export function setupShortcuts(editor) {
    const editorEl = editor.editor;
    
    editorEl.addEventListener('keydown', (event) => {
        // Ctrl+K / Cmd+K でリンク
        if (_isModifierKeyPressed(event) && !event.shiftKey && event.key === 'k') {
            event.preventDefault();
            _handleLinkShortcut(editor);
        }
        
        // Ctrl+Shift+; で文字を赤色に
        if (_isModifierKeyPressed(event) && event.shiftKey && _isSemicolonKey(event)) {
            event.preventDefault();
            _handleRedColorShortcut(editor);
        }
        
        // Ctrl+Shift+' で文字を青色に
        if (_isModifierKeyPressed(event) && event.shiftKey && _isQuoteKey(event)) {
            event.preventDefault();
            _handleBlueColorShortcut(editor);
        }
    });
    
    // URL自動リンク（簡易版）
    editorEl.addEventListener('input', () => {
        setTimeout(() => {
            _autoLinkURLs(editorEl);
        }, AUTO_LINK_DELAY_MS);
    });
}

// リンクを作成して挿入する
function _createAndInsertLink(range, url, linkText, shouldSelectLink = false) {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = linkText;
    
    if (shouldSelectLink) {
        range.insertNode(link);
        range.setStartAfter(link);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        range.deleteContents();
        range.insertNode(link);
    }
}

// 選択範囲を取得する
function _getSelectionRange() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    return selection.getRangeAt(0);
}

// 選択範囲に色を適用または解除する
function _applyOrToggleColor(range, targetColor) {
    const selection = window.getSelection();
    const hasColor = _checkAndRemoveColor(range, targetColor);
    
    if (!hasColor) {
        const span = document.createElement('span');
        span.style.color = targetColor;
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
    
    return hasColor;
}

// リンクショートカットを処理する
function _handleLinkShortcut(editor) {
    const range = _getSelectionRange();
    if (!range) return;
    
    const selectedText = range.toString().trim();
    const inputUrl = prompt('リンクのURLを入力してください:', DEFAULT_LINK_URL);
    
    if (inputUrl && inputUrl !== DEFAULT_LINK_URL) {
        const linkText = selectedText || inputUrl;
        const shouldSelectLink = !selectedText;
        
        _createAndInsertLink(range, inputUrl, linkText, shouldSelectLink);
        editor.updatePlaceholder();
    }
}

// 赤色ショートカットを処理する
function _handleRedColorShortcut(editor) {
    const range = _getSelectionRange();
    if (!range) return;
    
    const selectedText = range.toString().trim();
    
    if (selectedText) {
        _applyOrToggleColor(range, COLOR_RED);
        editor.updatePlaceholder();
    }
}

// 青色ショートカットを処理する
function _handleBlueColorShortcut(editor) {
    const range = _getSelectionRange();
    if (!range) return;
    
    const selectedText = range.toString().trim();
    
    if (selectedText) {
        _applyOrToggleColor(range, COLOR_BLUE);
        editor.updatePlaceholder();
    }
}

// 修飾キーが押されているかチェック（Ctrl/Cmd）
function _isModifierKeyPressed(event) {
    return event.ctrlKey || event.metaKey;
}

// セミコロンキーが押されたかチェック
function _isSemicolonKey(event) {
    return event.key === ';' || event.key === ':' || event.code === 'Semicolon';
}

// クォートキーが押されたかチェック
function _isQuoteKey(event) {
    return event.key === '\'' || event.key === '"' || event.code === 'Quote';
}

// span要素の色が対象色と一致するかチェック
function _isColorMatch(spanElement, targetColor, selectedTextContent) {
    if (!spanElement.style.color) return false;
    
    const spanColor = spanElement.style.color;
    const normalizedSpanColor = _normalizeColorToHex(spanColor);
    const normalizedTarget = _normalizeColorToHex(targetColor);
    
    if (normalizedSpanColor !== normalizedTarget) return false;
    
    const spanText = spanElement.textContent.trim();
    return spanText === selectedTextContent;
}

// span要素を削除して中身を展開する
function _removeSpanAndUnwrap(spanElement, selectedTextContent) {
    const parent = spanElement.parentElement;
    if (!parent) return;
    
    const fragment = document.createDocumentFragment();
    while (spanElement.firstChild) {
        fragment.appendChild(spanElement.firstChild);
    }
    
    const nextSibling = spanElement.nextSibling;
    if (nextSibling) {
        parent.insertBefore(fragment, nextSibling);
    } else {
        parent.appendChild(fragment);
    }
    
    spanElement.remove();
    _restoreSelection(parent, selectedTextContent);
}

// 共通の親要素自体がspan要素の場合の処理
function _checkCommonAncestorSpan(commonAncestor, targetColor, selectedTextContent) {
    if (commonAncestor.nodeType !== Node.ELEMENT_NODE) return false;
    if (commonAncestor.tagName !== 'SPAN') return false;
    if (!commonAncestor.style.color) return false;
    
    if (_isColorMatch(commonAncestor, targetColor, selectedTextContent)) {
        _removeSpanAndUnwrap(commonAncestor, selectedTextContent);
        return true;
    }
    
    return false;
}

// 開始ノードから親要素をたどってspan要素を探す
function _findColorSpanFromStartNode(range, ancestorElement, targetColor, selectedTextContent) {
    let startNode = range.startContainer;
    let currentNode = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
    
    while (currentNode && currentNode !== ancestorElement && currentNode !== document.body) {
        if (currentNode.tagName === 'SPAN' && _isColorMatch(currentNode, targetColor, selectedTextContent)) {
            return currentNode;
        }
        currentNode = currentNode.parentElement;
    }
    
    return null;
}

// 共通の親要素内のすべてのspan要素を検索
function _findColorSpanInAncestor(ancestorElement, range, targetColor, selectedTextContent) {
    const allSpans = Array.from(ancestorElement.querySelectorAll('span[style*="color"]'));
    
    return allSpans.find(span => {
        if (!_isColorMatch(span, targetColor, selectedTextContent)) return false;
        
        if (!range.intersectsNode(span)) return false;
        
        try {
            const spanRange = document.createRange();
            spanRange.selectNodeContents(span);
            const spanTextFromRange = spanRange.toString().trim();
            
            if (spanTextFromRange === selectedTextContent) {
                return true;
            }
        } catch (err) {
            // エラーが発生した場合でも、テキストが一致していれば使用
            const spanText = span.textContent.trim();
            if (spanText === selectedTextContent) {
                return true;
            }
        }
        
        return false;
    }) || null;
}

// 指定された色が適用されているかチェックし、適用されている場合は解除
function _checkAndRemoveColor(range, targetColor) {
    const selectedTextContent = range.toString().trim();
    if (!selectedTextContent) return false;
    
    const commonAncestor = range.commonAncestorContainer;
    
    if (_checkCommonAncestorSpan(commonAncestor, targetColor, selectedTextContent)) {
        return true;
    }
    
    const ancestorElement = commonAncestor.nodeType === Node.TEXT_NODE 
        ? commonAncestor.parentElement 
        : commonAncestor;
    
    if (!ancestorElement) return false;
    
    let foundColorSpan = _findColorSpanFromStartNode(range, ancestorElement, targetColor, selectedTextContent);
    
    if (!foundColorSpan) {
        foundColorSpan = _findColorSpanInAncestor(ancestorElement, range, targetColor, selectedTextContent);
    }
    
    if (foundColorSpan) {
        _removeSpanAndUnwrap(foundColorSpan, selectedTextContent);
        return true;
    }
    
    return false;
}

// 選択範囲を復元するヘルパー関数
function _restoreSelection(parentElement, textContent) {
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
                
                let currentPos = 0;
                let startNode = null;
                let startPos = 0;
                
                // 開始位置を見つける
                let textNode = walker.nextNode();
                while (textNode) {
                    const nodeLength = textNode.textContent.length;
                    
                    if (currentPos + nodeLength > startIndex && !startNode) {
                        startNode = textNode;
                        startPos = startIndex - currentPos;
                        break;
                    }
                    
                    currentPos += nodeLength;
                    textNode = walker.nextNode();
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
    }, SELECTION_RESTORE_DELAY_MS);
}

// 色をHEX形式に正規化
function _normalizeColorToHex(color) {
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

function _autoLinkURLs(editorEl) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        editorEl,
        NodeFilter.SHOW_TEXT,
        null
    );
    
    let node = walker.nextNode();
    while (node) {
        if (node.textContent.match(/https?:\/\/[^\s]+/)) {
            textNodes.push(node);
        }
        node = walker.nextNode();
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