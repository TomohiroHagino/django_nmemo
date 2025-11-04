import { HighlightCore } from './highlight-core.js';
import { EventHandlers } from './event-handlers.js';
import { MutationObserverHandler } from './mutation-observer.js';
import { CodeBlockInserter } from './code-block-inserter.js';
import { CodeBlockUtils } from './code-block-utils.js';

// メインクラス
export class SyntaxHighlighter {
    constructor(editor) {
        this.editor = editor;
        this.editorEl = editor.editor;
        this.setupState();
        this.initFlags();
        this.initTimeouts();
        
        this.utils = new CodeBlockUtils(this.editorEl);
        this.highlightCore = new HighlightCore(editor, this.editorEl);
        this.eventHandlers = new EventHandlers(this);
        this.mutationObserver = new MutationObserverHandler(this);
        this.codeBlockInserter = new CodeBlockInserter(this);
        
        this.observer = null;
    }

    setupState() {
        if (!this.editor._syntaxHighlightSetup) {
            this.editor._syntaxHighlightSetup = {};
        }
        this.state = this.editor._syntaxHighlightSetup;
    }

    initFlags() {
        let isInsertingCodeBlock = false;
        Object.defineProperty(this.state, 'isInsertingCodeBlock', {
            get: () => isInsertingCodeBlock,
            set: (value) => {
                isInsertingCodeBlock = value;
            }
        });
    }

    initTimeouts() {
        this.inputTimeout = null;
        this.codeBlockExitTimeout = null;
        this.isProcessingInput = false;
        this.beforeInputHandled = false;
        this.lastHighlightedCodeBlock = null;
    }

    // コードブロックから抜けたときにハイライトを適用
    handleCodeBlockExit() {
        // 入力中フラグをクリア（必ずクリアしてからハイライトを適用）
        if (this.state.isTyping) {
            this.state.isTyping = false;
        }
        
        // タイムアウトをクリア
        if (this.state.typingTimeout) {
            clearTimeout(this.state.typingTimeout);
            this.state.typingTimeout = null;
        }
        
        if (this.state.lastEditedCodeBlock) {
            const codeElement = this.state.lastEditedCodeBlock;
            
            if (codeElement && codeElement.parentElement && 
                codeElement.parentElement.tagName === 'PRE' && 
                this.editorEl.contains(codeElement.parentElement)) {
                
                const textContent = codeElement.textContent || codeElement.innerText;
                if (textContent && textContent.trim()) {
                    // ハイライトを確実に適用
                    requestAnimationFrame(() => {
                        this.highlightCore.highlightCodeBlock(codeElement, true);
                        this.lastHighlightedCodeBlock = codeElement;
                    });
                }
            }
            
            this.state.lastEditedCodeBlock = null;
        }
    }

    // 初期ハイライト
    initHighlight() {
        const hljs = this.highlightCore.getHljs();
        if (hljs && hljs.highlightElement) {
            console.log('highlight.js is ready, applying syntax highlight');
            setTimeout(() => {
                this.highlightCore.highlightCodeBlocks();
            }, 500);
        } else {
            if (!window._hljsRetryCount) {
                window._hljsRetryCount = 0;
            }
            if (window._hljsRetryCount < 50) {
                window._hljsRetryCount++;
                setTimeout(() => this.initHighlight(), 100);
            } else {
                console.error('highlight.js failed to load after 5 seconds');
            }
        }
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // beforeinput
        this.editorEl.addEventListener('beforeinput', (e) => this.eventHandlers.handleBeforeInput(e), true);
        
        // keydown
        this.editorEl.addEventListener('keydown', (e) => this.eventHandlers.handleCodeBlockEnter(e), true);
        
        // input
        this.editorEl.addEventListener('input', (e) => this.eventHandlers.handleInput(e));
        
        // selectionchange
        document.addEventListener('selectionchange', () => {
            clearTimeout(this.codeBlockExitTimeout);
            this.codeBlockExitTimeout = setTimeout(() => {
                const selection = window.getSelection();
                if (!selection.rangeCount) {
                    this.handleCodeBlockExit();
                    return;
                }

                const range = selection.getRangeAt(0);
                const codeElement = this.utils.isInCodeBlock(range);
                
                if (!codeElement) {
                    this.handleCodeBlockExit();
                }
            }, 100);
        });
        
        // blur
        this.editorEl.addEventListener('blur', () => {
            this.handleCodeBlockExit();
        }, true);
        
        // MutationObserver
        this.observer = new MutationObserver((mutations) => this.mutationObserver.handleMutation(mutations));
        this.observer.observe(this.editorEl, {
            childList: true,
            subtree: true
        });
    }

    // setContentのフック
    setupSetContentHook() {
        const originalSetContent = this.editor.setContent;
        if (originalSetContent) {
            this.editor.setContent = function(html) {
                const result = originalSetContent.call(this, html);
                setTimeout(() => {
                    const hljs = this.highlightCore.getHljs();
                    if (hljs && hljs.highlightElement) {
                        this.highlightCore.highlightCodeBlocks();
                    }
                }, 300);
                return result;
            }.bind(this);
        }
    }

    // 公開関数をeditorに設定
    exposeMethods() {
        this.editor.highlightCodeBlocks = () => this.highlightCore.highlightCodeBlocks();
        this.editor.highlightCodeBlock = (codeElement) => this.highlightCore.highlightCodeBlock(codeElement);
    }

    // セットアップメイン処理
    setup() {
        this.setupEventListeners();
        this.setupSetContentHook();
        this.initHighlight();
        this.exposeMethods();
    }

    // コードブロックを挿入
    insertCodeBlock(language = '', noHighlight = false) {
        this.codeBlockInserter.insert(language, noHighlight);
    }
}
