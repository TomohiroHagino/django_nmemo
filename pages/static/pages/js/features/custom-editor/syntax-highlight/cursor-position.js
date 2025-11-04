// カーソル位置の保存・復元ユーティリティ
export class CursorPositionManager {
    static saveCursorPosition(codeElement) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        
        const range = selection.getRangeAt(0);
        
        if (!codeElement.contains(range.startContainer) && 
            !codeElement.contains(range.commonAncestorContainer)) {
            return null;
        }
        
        const textContent = codeElement.textContent || codeElement.innerText;
        let cursorOffset = 0;
        
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
        
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            if (range.startContainer === textNode) {
                cursorOffset += range.startOffset;
                break;
            } else {
                cursorOffset += textNode.textContent.length;
            }
        }
        
        cursorOffset = Math.min(cursorOffset, textContent.length);
        return cursorOffset;
    }

    static restoreCursorPosition(codeElement, offset) {
        if (offset === null || offset === undefined) return false;
        
        const selection = window.getSelection();
        
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
        
        let currentOffset = 0;
        let targetNode = null;
        let targetOffset = 0;
        
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            const nodeLength = textNode.textContent.length;
            
            if (currentOffset + nodeLength >= offset) {
                targetNode = textNode;
                targetOffset = offset - currentOffset;
                break;
            }
            currentOffset += nodeLength;
        }
        
        if (!targetNode) {
            if (textNodes.length > 0) {
                targetNode = textNodes[textNodes.length - 1];
                targetOffset = targetNode.textContent.length;
            } else {
                targetNode = document.createTextNode('');
                codeElement.appendChild(targetNode);
                targetOffset = 0;
            }
        }
        
        try {
            const range = document.createRange();
            range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        } catch (err) {
            console.warn('カーソル位置の復元中にエラーが発生しました:', err);
            return false;
        }
    }
}