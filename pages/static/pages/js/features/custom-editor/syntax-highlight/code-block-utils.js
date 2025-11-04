// コードブロック検出・操作ユーティリティ
export class CodeBlockUtils {
    constructor(editorEl) {
        this.editorEl = editorEl;
    }

    // コードブロック内かどうかを判定
    isInCodeBlock(range) {
        if (!range) return null;
        
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        while (node && node !== this.editorEl && node !== document.body) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                const codeElement = node;
                if (!codeElement.classList.contains('no-highlight')) {
                    return codeElement;
                }
            }
            node = node.parentElement;
        }
        return null;
    }

    // no-highlightクラスのコードブロックも検出
    findNoHighlightCodeBlock(range) {
        if (!range) return null;
        
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        while (node && node !== this.editorEl && node !== document.body) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                if (node.classList.contains('no-highlight')) {
                    return node;
                }
            }
            node = node.parentElement;
        }
        return null;
    }

    // カーソルを<code>要素内に確実に配置する関数
    ensureCursorInCodeElement(preElement, selection) {
        if (!preElement || !selection) return null;
        
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return null;
        
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!range) return null;
        
        if (preElement.contains(range.startContainer)) {
            let currentNode = range.startContainer;
            if (currentNode.nodeType === Node.TEXT_NODE) {
                currentNode = currentNode.parentElement;
            }
            
            if (!codeElement.contains(currentNode)) {
                const textNodes = [];
                const walker = document.createTreeWalker(
                    codeElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }
                
                let targetTextNode;
                if (textNodes.length > 0) {
                    targetTextNode = textNodes[textNodes.length - 1];
                } else {
                    targetTextNode = document.createTextNode('');
                    codeElement.appendChild(targetTextNode);
                }
                
                const newRange = document.createRange();
                newRange.setStart(targetTextNode, targetTextNode.textContent.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                return codeElement;
            }
        }
        
        return codeElement;
    }

    // テキストノードのオフセットを計算
    calculateCursorOffset(codeElement, range) {
        let cursorOffset = 0;
        const textNodes = [];
        const walker = document.createTreeWalker(
            codeElement,
            NodeFilter.SHOW_TEXT,
            null
        );
        let tn;
        while (tn = walker.nextNode()) {
            textNodes.push(tn);
        }
        
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            if (range.startContainer === node) {
                cursorOffset += range.startOffset;
                break;
            } else {
                cursorOffset += node.textContent.length;
            }
        }
        
        return cursorOffset;
    }
}
