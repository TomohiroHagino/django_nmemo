import { CursorPositionManager } from './cursor-position.js';

// ハイライト処理のコア
export class HighlightCore {
    constructor(editor, editorEl) {
        this.editor = editor;
        this.editorEl = editorEl;
    }

    // hljsへのアクセスを統一
    getHljs() {
        if (typeof window !== 'undefined' && window.hljs) {
            return window.hljs;
        }
        if (typeof hljs !== 'undefined') {
            return hljs;
        }
        return null;
    }

    // すべてのコードブロックをハイライト
    highlightCodeBlocks() {
        const hljs = this.getHljs();
        if (!hljs || !hljs.highlightElement) {
            console.warn('highlight.jsが読み込まれていません');
            return;
        }
        
        const codeBlocks = this.editorEl.querySelectorAll('pre code:not(.hljs):not(.no-highlight)');
        
        if (codeBlocks.length === 0) {
            return;
        }
        
        console.log(`${codeBlocks.length}個のコードブロックが見つかりました`);
        
        codeBlocks.forEach((code, index) => {
            const textContent = code.textContent || code.innerText;
            if (!textContent || !textContent.trim()) {
                return;
            }
            
            if (code.classList.contains('no-highlight') ||
                textContent.trim().startsWith('<!-- no-highlight -->') || 
                textContent.trim().startsWith('// no-highlight') ||
                textContent.trim().startsWith('/* no-highlight */')) {
                return;
            }
            
            try {
                hljs.highlightElement(code);
                console.log(`コードブロック ${index + 1} をハイライトしました`);
            } catch (err) {
                console.warn('コードのハイライト中にエラーが発生しました:', err);
            }
        });
    }

    // 単一のコードブロックをハイライト
    highlightCodeBlock(codeElement, force = false) {
        const hljs = this.getHljs();
        if (!codeElement || !hljs || !hljs.highlight) {
            return;
        }
        
        if (codeElement.classList.contains('no-highlight')) {
            return;
        }
        
        if (!force && codeElement.classList.contains('hljs')) {
            return;
        }
        
        const textContent = codeElement.textContent || codeElement.innerText;
        
        if (!textContent && !force) {
            if (!codeElement.className || codeElement.className === '') {
                return;
            }
        }
        
        try {
            if (!this.editor._syntaxHighlightSetup) {
                this.editor._syntaxHighlightSetup = {};
            }
            this.editor._syntaxHighlightSetup.isHighlighting = true;
            
            const savedCursorOffset = CursorPositionManager.saveCursorPosition(codeElement);
            
            if (force && (codeElement.classList.contains('hljs') || codeElement.hasAttribute('data-highlighted'))) {
                const text = codeElement.textContent || codeElement.innerText;
                const originalLanguageClass = Array.from(codeElement.classList)
                    .find(cls => cls.startsWith('language-') && cls !== 'language-undefined' && cls !== 'language-plaintext');
                
                if (text && text.trim()) {
                    codeElement.classList.remove('hljs');
                    codeElement.removeAttribute('data-highlighted');
                    codeElement.classList.remove('language-undefined');
                    codeElement.classList.remove('language-plaintext');
                    
                    while (codeElement.firstChild) {
                        codeElement.removeChild(codeElement.firstChild);
                    }
                    
                    codeElement.appendChild(document.createTextNode(text));
                    
                    if (originalLanguageClass) {
                        codeElement.className = originalLanguageClass;
                    } else if (!codeElement.className || codeElement.className === '') {
                        codeElement.className = '';
                    }
                    
                    if (savedCursorOffset !== null) {
                        CursorPositionManager.restoreCursorPosition(codeElement, savedCursorOffset);
                    }
                }
            }
            
            if (textContent && textContent.trim()) {
                try {
                    const preElement = codeElement.parentElement;
                    if (!preElement || preElement.tagName !== 'PRE') {
                        console.warn('code要素の親要素がPREではありません。ハイライトをスキップします');
                        return;
                    }
                    
                    const editorElParent = preElement.parentElement;
                    const preElementNextSibling = preElement.nextSibling;
                    const originalText = codeElement.textContent || codeElement.innerText;
                    
                    if (hljs.highlightAuto) {
                        const result = hljs.highlightAuto(originalText);
                        if (result && result.value) {
                            codeElement.innerHTML = result.value;
                            codeElement.className = result.language ? `language-${result.language}` : '';
                            codeElement.classList.add('hljs');
                            codeElement.setAttribute('data-highlighted', 'yes');
                            console.log('自動検出された言語:', result.language, codeElement.className);
                        } else {
                            codeElement.className = '';
                            console.log('自動検出に失敗しました。言語が検出されませんでした');
                        }
                    } else {
                        hljs.highlightElement(codeElement);
                    }
                    
                    console.log('コードブロックをハイライトしました:', codeElement.className);
                    
                    if (savedCursorOffset !== null) {
                        requestAnimationFrame(() => {
                            CursorPositionManager.restoreCursorPosition(codeElement, savedCursorOffset);
                        });
                    }
                    
                    requestAnimationFrame(() => {
                        const hasHighlight = codeElement.classList.contains('hljs');
                        const hasHighlightedAttribute = codeElement.hasAttribute('data-highlighted');
                        
                        if (!hasHighlight && !hasHighlightedAttribute && textContent && textContent.trim()) {
                            console.warn('ハイライトが適用されませんでした。再適用を試みます...');
                            try {
                                const reSavedCursorOffset = CursorPositionManager.saveCursorPosition(codeElement);
                                hljs.highlightElement(codeElement);
                                if (reSavedCursorOffset !== null) {
                                    requestAnimationFrame(() => {
                                        CursorPositionManager.restoreCursorPosition(codeElement, reSavedCursorOffset);
                                    });
                                }
                            } catch (err) {
                                console.error('ハイライトの再適用中にエラーが発生しました:', err);
                            }
                        }
                        
                        const currentPre = codeElement.parentElement;
                        if (!currentPre || currentPre.tagName !== 'PRE' || !this.editorEl.contains(currentPre)) {
                            console.warn('ハイライト直後にコードブロック構造が破損しました。復元を試みます');
                            const restoredPre = document.createElement('pre');
                            const restoredCode = document.createElement('code');
                            restoredCode.className = codeElement.className;
                            restoredCode.textContent = originalText;
                            restoredPre.appendChild(restoredCode);
                            
                            if (editorElParent === this.editorEl && preElementNextSibling) {
                                this.editorEl.insertBefore(restoredPre, preElementNextSibling);
                            } else if (editorElParent === this.editorEl) {
                                this.editorEl.appendChild(restoredPre);
                            }
                            
                            codeElement = restoredCode;
                            
                            if (savedCursorOffset !== null) {
                                CursorPositionManager.restoreCursorPosition(codeElement, savedCursorOffset);
                            }
                        }
                    });
                    
                    setTimeout(() => {
                        const preElement = codeElement.parentElement;
                        if (preElement && preElement.tagName === 'PRE' && preElement.parentElement) {
                            if (codeElement.parentElement === preElement && this.editorEl.contains(preElement)) {
                                if (this.editor._syntaxHighlightSetup) {
                                    this.editor._syntaxHighlightSetup.isHighlighting = false;
                                    console.log('ハイライトフラグをクリアしました（コードブロックは存在します）');
                                }
                            } else {
                                console.warn('ハイライト後のコードブロック構造が無効です。フラグを保持します');
                            }
                        } else {
                            console.warn('フラグクリア前にコードブロックが削除されました。フラグを保持します');
                        }
                    }, 500);
                } catch (err) {
                    console.warn('ハイライト適用中にエラーが発生しました:', err);
                    throw err;
                }
            } else {
                setTimeout(() => {
                    if (this.editor._syntaxHighlightSetup) {
                        this.editor._syntaxHighlightSetup.isHighlighting = false;
                    }
                }, 100);
            }
        } catch (err) {
            if (this.editor._syntaxHighlightSetup) {
                this.editor._syntaxHighlightSetup.isHighlighting = false;
            }
        }
    }
}