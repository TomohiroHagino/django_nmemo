// コードブロック挿入処理
export class CodeBlockInserter {
    constructor(highlighter) {
        this.highlighter = highlighter;
        this.editor = highlighter.editor;
        this.editorEl = highlighter.editorEl;
        this.highlightCore = highlighter.highlightCore;
    }

    insert(language = '', noHighlight = false) {
        console.log('コードブロック挿入が呼ばれました');
        
        if (!this.editorEl) {
            console.error('エディタ要素が見つかりません');
            return;
        }
        
        this.editor._syntaxHighlightSetup.isInsertingCodeBlock = true;
        
        if (this.editor.saveStateToHistory) {
            this.editor.saveStateToHistory();
        }
        
        this.editorEl.focus();
        
        requestAnimationFrame(() => {
            const selection = window.getSelection();
            let range = null;
            
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
                
                if (!this.editorEl.contains(range.commonAncestorContainer)) {
                    console.log('範囲がエディタ外です。新しい範囲を作成します');
                    range = null;
                }
            }
            
            if (!range || this.editorEl.childNodes.length === 0) {
                console.log('エディタが空または範囲がありません。デフォルトの範囲を作成します');
                range = document.createRange();
                
                if (this.editorEl.childNodes.length === 0) {
                    const p = document.createElement('p');
                    const br = document.createElement('br');
                    p.appendChild(br);
                    this.editorEl.appendChild(p);
                    range.setStart(p, 0);
                    range.collapse(true);
                } else {
                    const lastNode = this.editorEl.childNodes[this.editorEl.childNodes.length - 1];
                    if (lastNode.nodeType === Node.TEXT_NODE) {
                        range.setStart(lastNode, lastNode.length);
                    } else {
                        range.setStartAfter(lastNode);
                    }
                    range.collapse(true);
                }
                
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            
            if (noHighlight) {
                code.className = 'no-highlight';
            } else {
                if (language) {
                    code.className = `language-${language}`;
                } else {
                    code.className = 'language-text';
                }
            }
            
            const textNode = document.createTextNode('');
            code.appendChild(textNode);
            pre.appendChild(code);
            
            try {
                console.log('コードブロックの挿入を試みています:', range.startContainer, range.startOffset);
                
                if (!range.collapsed) {
                    range.deleteContents();
                    if (selection.rangeCount > 0) {
                        range = selection.getRangeAt(0);
                    }
                }
                
                // 挿入位置の決定
                let currentNode = range.startContainer;
                let blockElement = null;
                
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    currentNode = currentNode.parentElement;
                }
                
                while (currentNode && currentNode !== this.editorEl) {
                    if (currentNode.parentElement === this.editorEl) {
                        blockElement = currentNode;
                        break;
                    }
                    currentNode = currentNode.parentElement;
                }
                
                if (blockElement) {
                    let isAtStart = false;
                    
                    if (range.startContainer.nodeType === Node.TEXT_NODE) {
                        const textNode = range.startContainer;
                        const textParent = textNode.parentElement;
                        
                        if (textParent === blockElement || blockElement.contains(textParent)) {
                            const walker = document.createTreeWalker(
                                blockElement,
                                NodeFilter.SHOW_TEXT,
                                null
                            );
                            const firstText = walker.nextNode();
                            if (firstText === textNode && range.startOffset === 0) {
                                isAtStart = true;
                            }
                        }
                    } else if (range.startContainer === blockElement && range.startOffset === 0) {
                        isAtStart = true;
                    }
                    
                    if (isAtStart) {
                        this.editorEl.insertBefore(pre, blockElement);
                    } else {
                        if (blockElement.nextSibling) {
                            this.editorEl.insertBefore(pre, blockElement.nextSibling);
                        } else {
                            this.editorEl.appendChild(pre);
                        }
                    }
                } else {
                    const allChildren = Array.from(this.editorEl.children);
                    
                    if (allChildren.length === 0) {
                        this.editorEl.appendChild(pre);
                    } else {
                        let insertIndex = -1;
                        
                        for (let i = 0; i < allChildren.length; i++) {
                            const child = allChildren[i];
                            const childRange = document.createRange();
                            childRange.selectNodeContents(child);
                            
                            if (range.compareBoundaryPoints(Range.START_TO_START, childRange) < 0) {
                                insertIndex = i;
                                break;
                            }
                        }
                        
                        if (insertIndex >= 0) {
                            this.editorEl.insertBefore(pre, allChildren[insertIndex]);
                        } else {
                            this.editorEl.appendChild(pre);
                        }
                    }
                }
                
                console.log('コードブロックが挿入されました。DOM:', this.editorEl.innerHTML);
                
                const codeElementInDOM = pre.querySelector('code');
                if (codeElementInDOM) {
                    const textNodesInCode = [];
                    const walker = document.createTreeWalker(
                        codeElementInDOM,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let node;
                    while (node = walker.nextNode()) {
                        textNodesInCode.push(node);
                    }
                    
                    const targetTextNode = textNodesInCode.length > 0 ? textNodesInCode[0] : null;
                    if (targetTextNode) {
                        const newRange = document.createRange();
                        newRange.setStart(targetTextNode, 0);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } else {
                        const newTextNode = document.createTextNode('');
                        codeElementInDOM.appendChild(newTextNode);
                        const newRange = document.createRange();
                        newRange.setStart(newTextNode, 0);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
                
                if (this.editor.updatePlaceholder) {
                    this.editor.updatePlaceholder();
                }
                
                if (this.editor.saveStateToHistory) {
                    this.editor.saveStateToHistory();
                }
                
                setTimeout(() => {
                    if (!noHighlight) {
                        const hljs = this.highlightCore.getHljs();
                        if (hljs && hljs.highlightElement && this.editor.highlightCodeBlock) {
                            this.editor.highlightCodeBlock(code);
                        }
                    }
                    this.editor._syntaxHighlightSetup.isInsertingCodeBlock = false;
                    console.log('コードブロック挿入フラグをクリアしました');
                }, 300);
                
            } catch (error) {
                console.error('コードブロック挿入中にエラーが発生しました:', error);
                try {
                    this.editorEl.appendChild(pre);
                    const newRange = document.createRange();
                    newRange.setStart(textNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    if (this.editor.updatePlaceholder) {
                        this.editor.updatePlaceholder();
                    }
                } catch (e) {
                    console.error('コードブロックの挿入に失敗しました:', e);
                }
                this.editor._syntaxHighlightSetup.isInsertingCodeBlock = false;
            }
        });
    }
}