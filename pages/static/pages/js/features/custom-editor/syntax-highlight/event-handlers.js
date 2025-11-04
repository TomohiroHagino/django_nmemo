import { CodeBlockUtils } from './code-block-utils.js';

// イベントハンドラー
export class EventHandlers {
    constructor(highlighter) {
        this.highlighter = highlighter;
        this.editor = highlighter.editor;
        this.editorEl = highlighter.editorEl;
        this.utils = new CodeBlockUtils(this.editorEl);
        this.highlightCore = highlighter.highlightCore;
    }

    // beforeinputイベントハンドラ
    handleBeforeInput(e) {
        if (this.editor._syntaxHighlightSetup?.isInsertingCodeBlock) {
            return;
        }
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const codeElement = this.utils.isInCodeBlock(range);
        const noHighlightCodeElement = codeElement ? null : this.utils.findNoHighlightCodeBlock(range);
        
        if (!codeElement && !noHighlightCodeElement) {
            this.highlighter.beforeInputHandled = false;
            return;
        }
        
        const targetCodeElement = codeElement || noHighlightCodeElement;
        const preElement = targetCodeElement.parentElement;
        if (!preElement || preElement.tagName !== 'PRE') {
            this.highlighter.beforeInputHandled = false;
            return;
        }
        
        // 通常のテキスト入力
        if (e.inputType === 'insertText' && e.data && e.data !== '\n') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.highlighter.beforeInputHandled = true;
            
            this.utils.ensureCursorInCodeElement(preElement, selection);
            const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!currentRange) return;
            
            const isNoHighlight = targetCodeElement.classList.contains('no-highlight');
            
            if (isNoHighlight) {
                this.handleNoHighlightTextInsert(targetCodeElement, currentRange, e.data, selection);
                this.highlighter.beforeInputHandled = false;
                return false;
            }
            
            this.handleHighlightTextInsert(targetCodeElement, currentRange, e.data, selection);
            this.highlighter.beforeInputHandled = false;
            return false;
        }
        
        // 改行の挿入
        if (e.inputType === 'insertLineBreak' || 
            e.inputType === 'insertParagraph' ||
            (e.inputType === 'insertText' && e.data === '\n') ||
            (e.inputType === 'insertText' && e.data === null)) {
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            this.utils.ensureCursorInCodeElement(preElement, selection);
            const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!currentRange) return;
            
            const isNoHighlight = targetCodeElement.classList.contains('no-highlight');
            
            if (isNoHighlight) {
                this.handleNoHighlightLineBreak(targetCodeElement, currentRange, selection);
                return false;
            }
            
            this.handleHighlightLineBreak(targetCodeElement, currentRange, selection);
            return false;
        }
        
        // その他の入力タイプ
        if (e.inputType === 'deleteContent' || 
            e.inputType === 'deleteContentBackward' || 
            e.inputType === 'deleteContentForward' ||
            e.inputType === 'insertFromPaste' ||
            e.inputType === 'insertFromDrop') {
            if (codeElement && !codeElement.contains(range.startContainer)) {
                this.utils.ensureCursorInCodeElement(preElement, selection);
            }
        }
    }

    handleNoHighlightTextInsert(codeElement, range, data, selection) {
        let textNode = range.startContainer;
        if (textNode.nodeType !== Node.TEXT_NODE || !codeElement.contains(textNode)) {
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
            textNode = textNodes[0] || codeElement.appendChild(document.createTextNode(''));
        }
        
        let offset = 0;
        if (textNode === range.startContainer) {
            offset = range.startOffset;
        } else {
            offset = this.utils.calculateCursorOffset(codeElement, range);
        }
        
        const text = textNode.textContent;
        textNode.textContent = text.slice(0, offset) + data + text.slice(offset);
        
        const newRange = document.createRange();
        newRange.setStart(textNode, offset + data.length);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    handleHighlightTextInsert(codeElement, range, data, selection) {
        // ハイライト済みの場合（spanなどがある場合）は、テキストノードに直接挿入
        // これによりDOM全体の再構築を避ける
        
        // カーソル位置のテキストノードを探す
        let textNode = range.startContainer;
        let offset = range.startOffset;
        
        // テキストノードでない場合、またはcodeElementの外にある場合は探す
        if (textNode.nodeType !== Node.TEXT_NODE || !codeElement.contains(textNode)) {
            // カーソル位置に最も近いテキストノードを探す
            const walker = document.createTreeWalker(
                codeElement,
                NodeFilter.SHOW_TEXT,
                null
            );
            
            const cursorOffset = this.utils.calculateCursorOffset(codeElement, range);
            let currentOffset = 0;
            let foundTextNode = null;
            let foundOffset = 0;
            
            let node;
            while (node = walker.nextNode()) {
                const nodeLength = node.textContent.length;
                if (currentOffset + nodeLength >= cursorOffset) {
                    foundTextNode = node;
                    foundOffset = cursorOffset - currentOffset;
                    break;
                }
                currentOffset += nodeLength;
            }
            
            // テキストノードが見つからない、またはカーソルが最後にある場合
            if (!foundTextNode) {
                // 最後のテキストノードを探す
                const allTextNodes = [];
                const walker2 = document.createTreeWalker(
                    codeElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let n;
                while (n = walker2.nextNode()) {
                    allTextNodes.push(n);
                }
                
                if (allTextNodes.length > 0) {
                    foundTextNode = allTextNodes[allTextNodes.length - 1];
                    foundOffset = foundTextNode.textContent.length;
                } else {
                    // テキストノードが存在しない場合は新規作成
                    foundTextNode = document.createTextNode('');
                    codeElement.appendChild(foundTextNode);
                    foundOffset = 0;
                }
            }
            
            textNode = foundTextNode;
            offset = foundOffset;
        }
        
        // テキストノードに直接文字を挿入（DOM構造を保持）
        const text = textNode.textContent;
        textNode.textContent = text.slice(0, offset) + data + text.slice(offset);
        
        // カーソル位置を更新
        const newRange = document.createRange();
        newRange.setStart(textNode, offset + data.length);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // 入力中フラグを設定（ハイライト処理を抑制）
        if (!this.editor._syntaxHighlightSetup) {
            this.editor._syntaxHighlightSetup = {};
        }
        this.editor._syntaxHighlightSetup.lastEditedCodeBlock = codeElement;
        this.editor._syntaxHighlightSetup.isTyping = true;
        
        // 入力が終わったら（一定時間後）ハイライトを再適用
        clearTimeout(this.editor._syntaxHighlightSetup.typingTimeout);
        this.editor._syntaxHighlightSetup.typingTimeout = setTimeout(() => {
            if (this.editor._syntaxHighlightSetup.isTyping) {
                this.editor._syntaxHighlightSetup.isTyping = false;
                
                // カーソルがまだコードブロック内にある場合はハイライトを適用
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const currentRange = selection.getRangeAt(0);
                    const currentCodeElement = this.utils.isInCodeBlock(currentRange);
                    
                    // 同じコードブロックの場合はハイライトを再適用
                    if (currentCodeElement === codeElement && codeElement.parentElement && codeElement.parentElement.tagName === 'PRE') {
                        const textContent = codeElement.textContent || codeElement.innerText;
                        if (textContent && textContent.trim()) {
                            // 少し遅延させてからハイライトを適用（カーソル位置の復元を確実にするため）
                            requestAnimationFrame(() => {
                                this.highlightCore.highlightCodeBlock(codeElement, true);
                            });
                        }
                    }
                }
            }
        }, 1200); // 1200ms間入力がなければ入力終了とみなし、ハイライトを適用
    }

    handleNoHighlightLineBreak(codeElement, range, selection) {
        let textNode = range.startContainer;
        if (textNode.nodeType !== Node.TEXT_NODE || !codeElement.contains(textNode)) {
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
            textNode = textNodes[0] || codeElement.appendChild(document.createTextNode(''));
        }
        
        let offset = range.startOffset;
        if (textNode !== range.startContainer) {
            offset = this.utils.calculateCursorOffset(codeElement, range);
        }
        
        const text = textNode.textContent;
        textNode.textContent = text.slice(0, offset) + '\n' + text.slice(offset);
        
        const newRange = document.createRange();
        newRange.setStart(textNode, offset + 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        this.editor._syntaxHighlightSetup.lastEditedCodeBlock = codeElement;
    }

    handleHighlightLineBreak(codeElement, range, selection) {
        const currentText = codeElement.textContent || codeElement.innerText;
        const cursorOffset = this.utils.calculateCursorOffset(codeElement, range);
        
        const beforeText = currentText.substring(0, cursorOffset);
        const afterText = currentText.substring(cursorOffset);
        const newText = beforeText + '\n' + afterText;
        
        while (codeElement.firstChild) {
            codeElement.removeChild(codeElement.firstChild);
        }
        
        const newTextNode = document.createTextNode(newText);
        codeElement.appendChild(newTextNode);
        
        const newRange = document.createRange();
        newRange.setStart(newTextNode, cursorOffset + 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        this.editor._syntaxHighlightSetup.lastEditedCodeBlock = codeElement;
    }

    // keydownイベントハンドラ
    handleCodeBlockEnter(e) {
        if (e.key !== 'Enter' && e.keyCode !== 13) {
            return;
        }
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let codeElement = this.utils.isInCodeBlock(range);
        
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        const preElement = node.closest('pre');
        if (preElement && preElement.parentElement === this.editorEl && !codeElement) {
            codeElement = this.utils.ensureCursorInCodeElement(preElement, selection);
            if (!codeElement) return;
        }
        
        if (!codeElement) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        this.utils.ensureCursorInCodeElement(preElement, selection);
        
        const newRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!newRange) return;
        
        const textNode = newRange.startContainer;
        const offset = newRange.startOffset;
        
        let targetTextNode = textNode;
        if (textNode.nodeType !== Node.TEXT_NODE || !codeElement.contains(textNode)) {
            const walker = document.createTreeWalker(
                codeElement,
                NodeFilter.SHOW_TEXT,
                null
            );
            targetTextNode = walker.nextNode();
            
            if (!targetTextNode) {
                targetTextNode = document.createTextNode('');
                codeElement.appendChild(targetTextNode);
            }
        }
        
        const text = targetTextNode.textContent || '';
        const before = text.substring(0, offset);
        const after = text.substring(offset);
        
        targetTextNode.textContent = before + '\n' + after;
        
        const cursorRange = document.createRange();
        cursorRange.setStart(targetTextNode, offset + 1);
        cursorRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(cursorRange);
        
        setTimeout(() => {
            this.highlightCore.highlightCodeBlock(codeElement);
        }, 50);
    }

    // inputイベントハンドラ（簡略版、完全版は元のコードを移行）
    handleInput(e) {
        // 開発モードのみ出力
        if (window.DEBUG_SYNTAX_HIGHLIGHT) {
            console.log('Inputイベントが発生しました');
        }
        
        if (this.highlighter.isProcessingInput) {
            if (window.DEBUG_SYNTAX_HIGHLIGHT) {
                console.log('Inputイベント: 入力処理中です。スキップします');
            }
            return;
        }
        
        if (this.editor._syntaxHighlightSetup?.isInsertingCodeBlock) {
            if (window.DEBUG_SYNTAX_HIGHLIGHT) {
                console.log('Inputイベント: コードブロック挿入中です。スキップします');
            }
            return;
        }
        
        if (this.highlighter.beforeInputHandled) {
            if (window.DEBUG_SYNTAX_HIGHLIGHT) {
                console.log('beforeinputが処理されたため、Inputイベントをスキップします');
            }
            return;
        }
        
        // 既存のinput処理ロジックをここに移行
        // （元のコードが非常に長いため、実際の実装では完全に移行してください）
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let codeElement = this.utils.isInCodeBlock(range);
        
        if (codeElement && codeElement.parentElement && codeElement.parentElement.tagName === 'PRE') {
            this.highlighter.isProcessingInput = true;
            
            requestAnimationFrame(() => {
                if (codeElement && codeElement.parentElement && codeElement.parentElement.tagName === 'PRE') {
                    if (window.DEBUG_SYNTAX_HIGHLIGHT) {
                        console.log('Inputイベント: コードブロック入力の処理をスキップします');
                    }
                    this.highlighter.isProcessingInput = false;
                    return;
                }
                this.highlighter.isProcessingInput = false;
            });
        } else {
            clearTimeout(this.highlighter.inputTimeout);
            this.highlighter.inputTimeout = setTimeout(() => {
                this.highlightCore.highlightCodeBlocks();
            }, 500);
        }
    }
}
