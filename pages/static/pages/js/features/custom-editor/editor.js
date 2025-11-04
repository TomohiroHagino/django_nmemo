import { setupStylePreservingClipboard } from './clipboard.js';

export class CustomEditor {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container ${containerId} not found`);
        }
        
        this.options = {
            placeholder: options.placeholder || 'コンテンツを入力してください...',
            isCreateModal: options.isCreateModal || false,
            ...options
        };
        
        // Undo/Redoスタック
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        this.init();
    }
    
    init() {
        // エディタ要素を作成
        this.editor = document.createElement('div');
        this.editor.className = 'custom-editor';
        this.editor.contentEditable = true;
        this.editor.setAttribute('data-placeholder', this.options.placeholder);
        
        // isCreateModalフラグをデータ属性に設定
        if (this.options.isCreateModal) {
            this.editor.setAttribute('data-is-create-modal', 'true');
        }
        
        // プレースホルダーの表示制御
        this.updatePlaceholder();
        this.editor.addEventListener('input', () => {
            this.updatePlaceholder();
            // Undoスタックに追加（通常の入力操作）
            // ただし、手動で履歴保存が行われた場合はスキップ
            if (!this._skipHistorySave) {
                this.saveToHistory();
            }
            this._skipHistorySave = false;
        });
        this.editor.addEventListener('focus', () => this.updatePlaceholder());
        this.editor.addEventListener('blur', () => this.updatePlaceholder());
        
        // スタイル付きコピペ処理
        setupStylePreservingClipboard(this);
        
        // フォーマット継承を防ぐ処理（取り消し線など）
        this.setupFormatPrevention();
        
        // キーボードショートカット（Undo/Redo）
        this.setupUndoRedo();
        
        // コンテナに追加
        this.container.innerHTML = '';
        this.container.appendChild(this.editor);
        
        // 初期状態を履歴に保存
        this.saveToHistory();

        this.editor.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
                // Ctrl/Cmdキーを押していない場合でもリンクを開く
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    // 新しいタブで開く
                    window.open(link.href, '_blank');
                }
            }
        });
    }
    
    setupUndoRedo() {
        this.editor.addEventListener('keydown', (e) => {
            // Cmd+Z (Mac) または Ctrl+Z (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Cmd+Shift+Z または Ctrl+Y (Redo)
            else if ((e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
                e.preventDefault();
                this.redo();
            }
            // 矢印キーでインラインコードブロックから出る処理
            else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                this.handleArrowKeyInCodeBlock(e);
            }
        });
    }

    handleArrowKeyInCodeBlock(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return; // 選択範囲がある場合は通常の動作
        
        const isRightArrow = e.key === 'ArrowRight';
        
        // 現在のノードを取得
        let node = range.startContainer;
        let offset = range.startOffset;
        
        // code要素を探す（pre内のcodeは除外）
        let codeElement = null;
        if (node.nodeType === Node.TEXT_NODE) {
            codeElement = node.parentElement?.closest('code');
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            codeElement = node.closest('code');
        }
        
        // pre内のcode（コードブロック）は除外
        if (codeElement && codeElement.closest('pre') !== null) {
            codeElement = null;
        }
        
        if (!codeElement) return;
        
        let cursorMoved = false;
        
        // 右矢印キーの場合
        if (isRightArrow) {
            // コードブロックの最後にいるかチェック
            if (node.nodeType === Node.TEXT_NODE) {
                // テキストノードの最後にいる場合
                if (offset >= node.length) {
                    // 次の兄弟ノードがない、またはcode要素の最後の場合
                    if (!node.nextSibling || codeElement.contains(node) && node.parentElement === codeElement && !node.nextSibling) {
                        e.preventDefault();
                        // code要素の後ろにカーソルを移動
                        const newRange = document.createRange();
                        if (codeElement.nextSibling) {
                            if (codeElement.nextSibling.nodeType === Node.TEXT_NODE) {
                                newRange.setStart(codeElement.nextSibling, 0);
                            } else {
                                newRange.setStartBefore(codeElement.nextSibling);
                            }
                        } else {
                            // code要素の親要素の後にテキストノードを作成
                            const textNode = document.createTextNode('\u200B');
                            codeElement.parentElement.insertBefore(textNode, codeElement.nextSibling);
                            newRange.setStart(textNode, 0);
                        }
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        cursorMoved = true;
                    }
                }
            }
            
            // code要素の最後のテキストノードの最後にいる場合
            if (!cursorMoved) {
                const lastTextNode = this.getLastTextNode(codeElement);
                if (lastTextNode && node === lastTextNode && offset >= node.length) {
                    e.preventDefault();
                    const textNode = document.createTextNode('\u200B');
                    codeElement.parentElement.insertBefore(textNode, codeElement.nextSibling);
                    const newRange = document.createRange();
                    newRange.setStart(textNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    cursorMoved = true;
                }
            }
        }
        // 左矢印キーの場合
        else {
            // コードブロックの最初にいるかチェック
            if (node.nodeType === Node.TEXT_NODE) {
                // テキストノードの最初にいる場合
                if (offset === 0) {
                    // 前の兄弟ノードがない、またはcode要素の最初の場合
                    if (!node.previousSibling || (codeElement.contains(node) && node.parentElement === codeElement && !node.previousSibling)) {
                        e.preventDefault();
                        // code要素の前にカーソルを移動
                        const newRange = document.createRange();
                        if (codeElement.previousSibling) {
                            if (codeElement.previousSibling.nodeType === Node.TEXT_NODE) {
                                newRange.setStart(codeElement.previousSibling, codeElement.previousSibling.length);
                            } else {
                                newRange.setStartAfter(codeElement.previousSibling);
                            }
                        } else {
                            // code要素の親要素の前にテキストノードを作成
                            const textNode = document.createTextNode('\u200B');
                            codeElement.parentElement.insertBefore(textNode, codeElement);
                            newRange.setStart(textNode, 0);
                        }
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        cursorMoved = true;
                    }
                }
            }
            
            // code要素の最初のテキストノードの最初にいる場合
            if (!cursorMoved) {
                const firstTextNode = this.getFirstTextNode(codeElement);
                if (firstTextNode && node === firstTextNode && offset === 0) {
                    e.preventDefault();
                    const textNode = document.createTextNode('\u200B');
                    codeElement.parentElement.insertBefore(textNode, codeElement);
                    const newRange = document.createRange();
                    newRange.setStart(textNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    cursorMoved = true;
                }
            }
        }
        
        // カーソルが移動した場合、ツールバーの状態を更新
        if (cursorMoved && this.toolbar) {
            // 少し遅延させてから状態を更新（カーソル移動の完了を待つ）
            setTimeout(() => {
                if (this.toolbar && this.toolbar.updateActiveState) {
                    this.toolbar.updateActiveState();
                }
            }, 0);
        }
    }

    getLastTextNode(element) {
        if (!element) return null;
        let lastText = null;
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
        );
        let node;
        while (node = walker.nextNode()) {
            lastText = node;
        }
        return lastText;
    }

    getFirstTextNode(element) {
        if (!element) return null;
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
        );
        return walker.nextNode();
    }
    
    saveToHistory() {
        const currentHTML = this.editor.innerHTML;
        
        // 直前の履歴と同じ場合は追加しない
        if (this.history.length > 0 && this.history[this.historyIndex] === currentHTML) {
            return;
        }
        
        // 現在のインデックスより後ろの履歴を削除（新しい操作が行われた場合）
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // 新しい状態を追加
        this.history.push(currentHTML);
        this.historyIndex++;
        
        // 履歴のサイズを制限
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const previousHTML = this.history[this.historyIndex];
            
            // 選択範囲を保存
            const selection = window.getSelection();
            let savedRange = null;
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }
            
            // 状態を復元
            this.editor.innerHTML = previousHTML;
            
            // 選択範囲を復元
            if (savedRange && this.editor.contains(savedRange.commonAncestorContainer)) {
                try {
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                } catch (e) {
                    // 範囲が無効になった場合は無視
                }
            }
            
            this.updatePlaceholder();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const nextHTML = this.history[this.historyIndex];
            
            // 選択範囲を保存
            const selection = window.getSelection();
            let savedRange = null;
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }
            
            // 状態を復元
            this.editor.innerHTML = nextHTML;
            
            // 選択範囲を復元
            if (savedRange && this.editor.contains(savedRange.commonAncestorContainer)) {
                try {
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                } catch (e) {
                    // 範囲が無効になった場合は無視
                }
            }
            
            this.updatePlaceholder();
        }
    }
    
    // 外部から履歴に保存するメソッド（フォントサイズ変更などで使用）
    saveStateToHistory() {
        // inputイベントによる自動保存をスキップ
        this._skipHistorySave = true;
        this.saveToHistory();
    }

    setupFormatPrevention() {
        // beforeinputイベントで、フォーマット要素内の入力を検出
        this.editor.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
                const selection = window.getSelection();
                if (!selection.rangeCount) return;
                
                const range = selection.getRangeAt(0);
                let node = range.startContainer;
                
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentElement;
                }
                
                // フォーマット要素（s, strong, em, u）の中にカーソルがある場合
                // 特に、取り消し線（s）の場合は通常のテキストノードに移動
                if (node && node.tagName === 'S') {
                    // 取り消し線要素の後に通常のテキストノードを作成
                    const textNode = document.createTextNode('');
                    
                    if (node.nextSibling) {
                        node.parentElement.insertBefore(textNode, node.nextSibling);
                    } else {
                        node.parentElement.appendChild(textNode);
                    }
                    
                    // カーソルを移動
                    const newRange = document.createRange();
                    newRange.setStart(textNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        });
    }

    updatePlaceholder() {
        const hasContent = this.editor.textContent.trim().length > 0 || 
                          this.editor.querySelector('table, img, video, iframe');
        
        if (hasContent) {
            this.editor.classList.remove('empty');
        } else {
            this.editor.classList.add('empty');
        }
    }

    // パブリックメソッド
    getContent() {
        return this.editor.innerHTML;
    }

    setContent(html) {
        this.editor.innerHTML = html || '';
        this.updatePlaceholder();
    }

    focus() {
        this.editor.focus();
    }

    clear() {
        this.editor.innerHTML = '';
        this.updatePlaceholder();
    }
    
    // Quill互換性メソッド（既存コードとの互換性のため）
    get root() {
        return this.editor;
    }
    
    // Quill互換: setContents() - 空配列の場合はエディタをクリア
    setContents(contents) {
        if (!contents || (Array.isArray(contents) && contents.length === 0)) {
            this.clear();
        } else {
            // Delta形式の場合は処理が必要だが、現時点では空配列のみ対応
            this.clear();
        }
        return this;
    }

    // クリーンアップメソッドを追加
    destroy() {
        // イベントリスナーを削除
        if (this.editor) {
            // すべてのイベントリスナーを削除するためにクローンを作成
            const newEditor = this.editor.cloneNode(true);
            this.editor.parentNode?.replaceChild(newEditor, this.editor);
        }
        
        // 履歴をクリア
        this.history = [];
        this.historyIndex = -1;
        
        // その他の参照をクリア
        this.editor = null;
        this.container = null;
    }
}
