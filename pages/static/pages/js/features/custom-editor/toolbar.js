// pages/static/pages/js/features/custom-editor/toolbar.js
import { insertCodeBlock } from './syntax-highlight.js';

export class Toolbar {
    constructor(editor, containerId) {
        this.editor = editor;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'custom-toolbar';
            editor.container.parentElement.insertBefore(this.container, editor.container);
        }

        this.fontSizeDropdown = null;
        this.colorDropdown = null;
        editor.toolbar = this;
        this.init();
    }

    init() {
        const buttons = [
            // フォントサイズ
            { custom: 'fontSize', icon: '<strong>Aa</strong>', title: 'フォントサイズ' },
            { separator: true },
            // 見出し
            { cmd: 'formatBlock', value: '<h1>', icon: 'H₁', title: '見出し1' },
            { cmd: 'formatBlock', value: '<h2>', icon: 'H₂', title: '見出し2' },
            { cmd: 'formatBlock', value: '<h3>', icon: 'H₃', title: '見出し3' },
            { separator: true },
            // テキスト配置
            { cmd: 'justifyLeft', icon: '⬅️', title: '左寄せ' },
            { cmd: 'justifyCenter', icon: '↔️', title: '中央寄せ' },
            { cmd: 'justifyRight', icon: '➡️', title: '右寄せ' },
            { separator: true },
            // テキストスタイル
            { cmd: 'bold', icon: '<strong>B</strong>', title: '太字', html: true },
            { cmd: 'italic', icon: '<em>I</em>', title: '斜体', html: true },
            { cmd: 'underline', icon: '<u>U</u>', title: '下線', html: true },
            { cmd: 'strikeThrough', icon: '<s>S</s>', title: '取り消し線', html: true },
            { separator: true },
            // リスト
            { cmd: 'insertUnorderedList', icon: '☰', title: '箇条書き' },
            { cmd: 'insertOrderedList', icon: '1️⃣', title: '番号付きリスト' },
            { separator: true },
            // コード
            // コード
            { custom: 'code', icon: '<code>&lt;/&gt;</code>i', title: 'インラインコード', html: true },
            { custom: 'codeBlock', icon: '{ }', title: 'コードブロック（ハイライト）', html: true },
            { custom: 'codeBlockNoHighlight', icon: '<code class="no-highlight-icon">{ }</code>', title: 'コードブロック（ハイライトなし）', html: true },
            { separator: true },
            // 色
            { custom: 'color', icon: '<span class="color-icon-text">A</span>', title: '文字色', html: true },
            { custom: 'background', icon: '<span class="color-icon-bg">A</span>', title: '背景色', html: true },
            { separator: true },
            // 挿入
            { custom: 'link', icon: '🔗', title: 'リンク' },
            { custom: 'image', icon: '🖼️', title: '画像' },
            { custom: 'video', icon: '▶️', title: '動画' },
        ];

        buttons.forEach(btn => {
            if (btn.separator) {
                const sep = document.createElement('span');
                sep.className = 'toolbar-separator';
                this.container.appendChild(sep);
            } else if (btn.custom) {
                const button = this.createCustomButton(btn);
                this.container.appendChild(button);
            } else {
                const button = this.createButton(btn);
                this.container.appendChild(button);
            }
        });
    }

    createButton({ cmd, value, icon, title, html }) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toolbar-btn';
        if (html) {
            button.innerHTML = icon;
        } else {
            button.textContent = icon;
        }
        button.title = title;
        button.setAttribute('data-cmd', cmd);
        if (value) {
            button.setAttribute('data-value', value);
        }

        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.editor.editor.focus();

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            // テキスト配置コマンドの場合は、既に適用されているかチェック
            if (cmd === 'justifyLeft' || cmd === 'justifyCenter' || cmd === 'justifyRight') {
                const blockElement = this.getBlockElementForAlign(range);
                if (blockElement) {
                    const currentAlign = this.getTextAlign(blockElement);
                    const targetAlign = cmd === 'justifyLeft' ? 'left' :
                                        cmd === 'justifyCenter' ? 'center' : 'right';

                    // 既に同じ配置が適用されている場合は解除（左寄せに戻す）
                    if (currentAlign === targetAlign) {
                        // text-alignスタイルを削除して左寄せに戻す
                        blockElement.style.textAlign = '';
                        // style属性が空の場合は削除
                        if (!blockElement.getAttribute('style') || blockElement.getAttribute('style').trim() === '') {
                            blockElement.removeAttribute('style');
                        }
                    } else {
                        // 異なる配置を適用
                        document.execCommand(cmd, false, null);
                    }
                } else {
                    // ブロック要素が見つからない場合は通常通り実行
                    document.execCommand(cmd, false, null);
                }
            } else {
                // その他のコマンドは通常通り実行
                if (value) {
                    document.execCommand(cmd, false, value);
                } else {
                    document.execCommand(cmd, false, null);
                }
            }
            this.editor.updatePlaceholder();
            this.updateActiveState();
        });
        return button;
    }

    createCustomButton({ custom, icon, title, html }) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toolbar-btn';

        if (custom === 'fontSize') {
            // フォントサイズボタンは特別な処理
            const wrapper = document.createElement('div');
            wrapper.className = 'font-size-wrapper';
            wrapper.style.position = 'relative';

            button.innerHTML = icon;
            button.title = title;

            wrapper.appendChild(button);
            this.container.appendChild(wrapper);

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFontSizeDropdown(wrapper, button);
            });

            // ドロップダウン外クリックで閉じる
            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target) && this.fontSizeDropdown) {
                    this.closeFontSizeDropdown();
                }
            });

            return wrapper;
        } else if (custom === 'color' || custom === 'background') {
            // カラーパレットボタン
            const wrapper = document.createElement('div');
            wrapper.className = 'color-picker-wrapper';
            wrapper.style.position = 'relative';

            button.innerHTML = icon;
            button.title = title;

            wrapper.appendChild(button);
            this.container.appendChild(wrapper);

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleColorPicker(wrapper, button, custom);
            });

            // ドロップダウン外クリックで閉じる
            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target) && this.colorDropdown) {
                    this.closeColorPicker();
                }
            });

            return wrapper;
        } else {
            if (html) {
                button.innerHTML = icon;
            } else {
                button.textContent = icon;
            }
            button.title = title;
            button.setAttribute('data-custom', custom);

            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCustomAction(custom);
            });

            return button;
        }
    }

    toggleFontSizeDropdown(wrapper, button) {
        if (this.fontSizeDropdown && this.fontSizeDropdown.parentElement === wrapper) {
            this.closeFontSizeDropdown();
            return;
        }

        this.closeFontSizeDropdown();
        this.closeColorPicker();

        // ドロップダウンを開く前に選択範囲を保存
        const selection = window.getSelection();
        let savedRangeBeforeOpen = null;
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (this.editor.editor.contains(range.commonAncestorContainer)) {
                savedRangeBeforeOpen = range.cloneRange();
            }
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'font-size-dropdown';

        const sizes = [
            { value: '10px', label: '10px - 極小' },
            { value: '12px', label: '12px - 小' },
            { value: '14px', label: '14px - 標準' },
            { value: '16px', label: '16px - 中' },
            { value: '18px', label: '18px - 大' },
            { value: '20px', label: '20px' },
            { value: '24px', label: '24px' },
            { value: '32px', label: '32px' },
            { value: '48px', label: '48px - 特大' },
        ];

        sizes.forEach(size => {
            const option = document.createElement('div');
            option.className = 'font-size-option';
            option.style.fontSize = size.value;
            option.textContent = size.label;
            option.dataset.value = size.value;

            option.addEventListener('mousedown', (e) => {
                e.preventDefault(); // mousedownでpreventDefaultすることで、選択範囲の解除を防ぐ
                e.stopPropagation();
            });

            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 保存された選択範囲を使用、なければ現在の選択範囲を取得
                let rangeToUse = savedRangeBeforeOpen;
                if (!rangeToUse) {
                    const currentSelection = window.getSelection();
                    if (currentSelection.rangeCount > 0) {
                        rangeToUse = currentSelection.getRangeAt(0).cloneRange();
                    }
                }

                if (!rangeToUse) {
                    this.closeFontSizeDropdown();
                    return;
                }

                // フォントサイズを適用
                this.applyFontSize(size.value, rangeToUse);

                // ドロップダウンを閉じる
                this.closeFontSizeDropdown();
            });

            dropdown.appendChild(option);
        });

        wrapper.appendChild(dropdown);
        this.fontSizeDropdown = dropdown;
    }

    closeFontSizeDropdown() {
        if (this.fontSizeDropdown) {
            this.fontSizeDropdown.remove();
            this.fontSizeDropdown = null;
        }
    }

    toggleColorPicker(wrapper, button, type) {
        if (this.colorDropdown && this.colorDropdown.parentElement === wrapper) {
            this.closeColorPicker();
            return;
        }

        this.closeColorPicker();
        this.closeFontSizeDropdown();

        // ドロップダウンを開く前に選択範囲を保存
        const selection = window.getSelection();
        let savedRangeBeforeOpen = null;
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (this.editor.editor.contains(range.commonAncestorContainer)) {
                savedRangeBeforeOpen = range.cloneRange();
            }
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'color-picker-dropdown';

        // カラーパレット（一般的な色）
        const colors = [
            '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
            '#FF0000', '#FF6600', '#FFCC00', '#99FF00', '#00FF00', '#00FFCC',
            '#0099FF', '#0066FF', '#6600FF', '#CC00FF', '#FF0099', '#FF0066',
            '#990000', '#CC6600', '#999900', '#669900', '#009900', '#009999',
            '#006699', '#003399', '#660099', '#9900CC', '#CC0099', '#CC0066'
        ];

        // カラーグリッドを作成
        const grid = document.createElement('div');
        grid.className = 'color-picker-grid';

        colors.forEach(color => {
            const colorBtn = document.createElement('button');
            colorBtn.type = 'button';
            colorBtn.className = 'color-picker-item';
            colorBtn.style.backgroundColor = color;
            colorBtn.dataset.color = color;
            colorBtn.title = color;

            // 明るい色の場合は境界線を追加
            if (color === '#FFFFFF' || color === '#CCCCCC' || color === '#FFCC00' ||
                color === '#99FF00' || color === '#00FFCC') {
                colorBtn.style.border = '1px solid #ddd';
            }

            colorBtn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // mousedownでpreventDefaultすることで、選択範囲の解除を防ぐ
                e.stopPropagation();
            });

            colorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 保存された選択範囲を使用、なければ現在の選択範囲を取得
                let rangeToUse = savedRangeBeforeOpen;
                if (!rangeToUse) {
                    const currentSelection = window.getSelection();
                    if (currentSelection.rangeCount > 0) {
                        rangeToUse = currentSelection.getRangeAt(0).cloneRange();
                    }
                }

                if (!rangeToUse) {
                    this.closeColorPicker();
                    return;
                }

                this.applyColor(color, type, rangeToUse);
                this.closeColorPicker();
            });

            grid.appendChild(colorBtn);
        });

        // カスタムカラー入力
        const customSection = document.createElement('div');
        customSection.className = 'color-picker-custom';

        const customLabel = document.createElement('label');
        customLabel.textContent = 'カスタム色:';
        customLabel.style.marginRight = '8px';

        const customInput = document.createElement('input');
        customInput.type = 'color';
        customInput.className = 'color-picker-input';
        customInput.value = '#000000';

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'color-picker-apply-btn';
        applyBtn.textContent = '適用';

        applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const color = customInput.value;

            // 保存された選択範囲を使用、なければ現在の選択範囲を取得
            let rangeToUse = savedRangeBeforeOpen;
            if (!rangeToUse) {
                const currentSelection = window.getSelection();
                if (currentSelection.rangeCount > 0) {
                    rangeToUse = currentSelection.getRangeAt(0).cloneRange();
                }
            }

            if (!rangeToUse) {
                this.closeColorPicker();
                return;
            }

            this.applyColor(color, type, rangeToUse);
            this.closeColorPicker();
        });

        customSection.appendChild(customLabel);
        customSection.appendChild(customInput);
        customSection.appendChild(applyBtn);

        dropdown.appendChild(grid);
        dropdown.appendChild(customSection);

        wrapper.appendChild(dropdown);
        this.colorDropdown = dropdown;
        this.colorPickerType = type;
    }

    closeColorPicker() {
        if (this.colorDropdown) {
            this.colorDropdown.remove();
            this.colorDropdown = null;
            this.colorPickerType = null;
        }
    }

    applyColor(color, type, savedRange = null) {
        this.editor.editor.focus();

        // 選択範囲を取得
        const selection = window.getSelection();
        let range = null;

        if (savedRange) {
            range = savedRange;
            try {
                selection.removeAllRanges();
                selection.addRange(range.cloneRange());
            } catch (e) {
                console.error('保存された範囲の復元に失敗:', e);
                return;
            }
        }

        if (selection.rangeCount === 0) {
            return;
        }

        range = selection.getRangeAt(0);

        if (!this.editor.editor.contains(range.commonAncestorContainer)) {
            return;
        }

        const selectedText = range.toString().trim();
        if (!selectedText) {
            return;
        }

        try {
            // 変更前の状態を履歴に保存
            if (this.editor.saveStateToHistory) {
                this.editor.saveStateToHistory();
            }

            // マーカーノードを使って挿入位置を保存
            const startMarker = document.createComment('start');
            const endMarker = document.createComment('end');

            // マーカーを挿入
            range.insertNode(startMarker);
            range.collapse(false);
            range.insertNode(endMarker);

            // マーカー間のすべてのノードを取得
            const nodesToWrap = [];
            let currentNode = startMarker.nextSibling;

            while (currentNode && currentNode !== endMarker) {
                const nextNode = currentNode.nextSibling;
                nodesToWrap.push(currentNode);
                currentNode = nextNode;
            }

            // 新しいspanを作成
            const span = document.createElement('span');
            if (type === 'color') {
                span.style.color = color;
            } else if (type === 'background') {
                span.style.backgroundColor = color;
            }

            // ノードをspanに移動
            nodesToWrap.forEach(node => {
                // 既存の色spanの場合は中身だけを取り出す
                if (node.nodeType === Node.ELEMENT_NODE &&
                    node.tagName === 'SPAN' &&
                    (node.style.color || node.style.backgroundColor)) {
                    while (node.firstChild) {
                        span.appendChild(node.firstChild);
                    }
                } else {
                    span.appendChild(node);
                }
            });

            // マーカーの間にspanを挿入
            startMarker.parentNode.insertBefore(span, startMarker);

            // マーカーを削除
            startMarker.remove();
            endMarker.remove();

            // 選択範囲を復元
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // 変更後の状態を履歴に保存
            if (this.editor.saveStateToHistory) {
                this.editor.saveStateToHistory();
            }
        } catch (e) {
            console.error('カラーの適用でエラー:', e);
        }

        this.editor.updatePlaceholder();
        this.updateActiveState();
    }

    applyFontSize(size, savedRange = null) {
        // エディタにフォーカス
        this.editor.editor.focus();

        // 選択範囲を取得
        const selection = window.getSelection();
        let range = null;

        if (savedRange) {
            range = savedRange;
            try {
                selection.removeAllRanges();
                selection.addRange(range.cloneRange());
            } catch (e) {
                console.error('保存された範囲の復元に失敗:', e);
                return;
            }
        }

        if (selection.rangeCount === 0) {
            return;
        }

        range = selection.getRangeAt(0);

        if (!this.editor.editor.contains(range.commonAncestorContainer)) {
            return;
        }

        const selectedText = range.toString().trim();
        if (!selectedText) {
            return;
        }

        try {
            // 変更前の状態を履歴に保存
            if (this.editor.saveStateToHistory) {
                this.editor.saveStateToHistory();
            }

            // マーカーノードを使って挿入位置を保存
            const startMarker = document.createComment('start');
            const endMarker = document.createComment('end');

            // マーカーを挿入
            range.insertNode(startMarker);
            range.collapse(false);
            range.insertNode(endMarker);

            // マーカー間のすべてのノードを取得
            const nodesToWrap = [];
            let currentNode = startMarker.nextSibling;

            while (currentNode && currentNode !== endMarker) {
                const nextNode = currentNode.nextSibling;
                nodesToWrap.push(currentNode);
                currentNode = nextNode;
            }

            // 新しいspanを作成
            const span = document.createElement('span');
            span.style.fontSize = size;

            // ノードをspanに移動
            nodesToWrap.forEach(node => {
                // 既存のフォントサイズspanの場合は中身だけを取り出す
                if (node.nodeType === Node.ELEMENT_NODE &&
                    node.tagName === 'SPAN' &&
                    node.style.fontSize) {
                    while (node.firstChild) {
                        span.appendChild(node.firstChild);
                    }
                } else {
                    span.appendChild(node);
                }
            });

            // マーカーの間にspanを挿入
            startMarker.parentNode.insertBefore(span, startMarker);

            // マーカーを削除
            startMarker.remove();
            endMarker.remove();

            // 選択範囲を復元
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // 変更後の状態を履歴に保存
            if (this.editor.saveStateToHistory) {
                this.editor.saveStateToHistory();
            }
        } catch (e) {
            console.error('フォントサイズの適用でエラー:', e);
        }

        this.editor.updatePlaceholder();
        this.updateActiveState();
    }

    updateActiveState() {
        // フォーマット状態を確認してボタンのアクティブ状態を更新
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            // 選択がない場合は全て非アクティブに
            const buttons = this.container.querySelectorAll('.toolbar-btn[data-cmd], .toolbar-btn[data-custom]');
            buttons.forEach(btn => btn.classList.remove('active'));
            return;
        }

        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;

        // エディタ外の選択は無視
        if (!this.editor.editor.contains(commonAncestor.nodeType === Node.TEXT_NODE
                ? commonAncestor.parentElement
                : commonAncestor)) {
            return;
        }

        // コマンドボタンの状態を更新
        const buttons = this.container.querySelectorAll('.toolbar-btn[data-cmd]');
        buttons.forEach(btn => {
            const cmd = btn.getAttribute('data-cmd');
            const value = btn.getAttribute('data-value');

            try {
                // 見出しなどのブロックフォーマットの場合は特別な処理
                if (cmd === 'formatBlock' && value) {
                    const blockTag = value.replace(/[<>]/g, '').toLowerCase();
                    const currentBlockTag = this.getCurrentBlockTag();
                    if (currentBlockTag === blockTag) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                } else if (cmd === 'justifyLeft' || cmd === 'justifyCenter' || cmd === 'justifyRight') {
                    // テキスト配置の状態を確認
                    const blockElement = this.getBlockElementForAlign(range);
                    const textAlign = this.getTextAlign(blockElement);

                    // 明示的にtext-alignが設定されていない場合は、どのボタンもアクティブにしない
                    if (textAlign === null) {
                        btn.classList.remove('active');
                    } else {
                        const targetAlign = cmd === 'justifyLeft' ? 'left' :
                                           cmd === 'justifyCenter' ? 'center' : 'right';

                        if (textAlign === targetAlign) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    }
                } else {
                    // 通常のコマンド（bold, italic, underlineなど）
                    if (document.queryCommandState(cmd)) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
            } catch (e) {
                // 一部のコマンドは状態を取得できない
                btn.classList.remove('active');
            }
        });

        // カスタムボタンの状態を更新
        const customButtons = this.container.querySelectorAll('.toolbar-btn[data-custom]');
        customButtons.forEach(btn => {
            const custom = btn.getAttribute('data-custom');

            if (custom === 'code') {
                // インラインコードの状態を確認
                let node = commonAncestor;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentElement;
                }

                // code要素内にいるかチェック
                const codeElement = node.closest('code');
                // pre内のcodeはコードブロックなので除外
                if (codeElement && codeElement.closest('pre') === null) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    getCurrentBlockTag(range) {
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        while (node && node !== this.editor.editor && node !== document.body) {
            if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'LI', 'BLOCKQUOTE'].includes(node.tagName)) {
                return node.tagName;
            }
            node = node.parentElement;
        }

        return null;
    }

    handleCustomAction(action) {
        this.editor.editor.focus();

        switch (action) {
            case 'link':
                const url = prompt('リンクのURLを入力してください:', 'https://');
                if (url) {
                    document.execCommand('createLink', false, url);
                }
                break;
            case 'code':
                // インラインコード
                this.applyInlineCode();
                break;
            case 'codeBlock':
                // コードブロック（ハイライトあり）
                insertCodeBlock(this.editor);
                break;
            case 'codeBlockNoHighlight':
                // コードブロック（ハイライトなし）
                insertCodeBlock(this.editor, '', true);
                break;
            case 'image':
                if (this.editor.onImageClick) {
                    this.editor.onImageClick();
                }
                break;
            case 'video':
                if (this.editor.onVideoClick) {
                    this.editor.onVideoClick();
                }
                break;
        }

        this.editor.updatePlaceholder();
        this.updateActiveState();
    }

    applyInlineCode() {
        this.editor.editor.focus();

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (!this.editor.editor.contains(range.commonAncestorContainer)) {
            return;
        }

        try {
            // 変更前の状態を履歴に保存
            if (this.editor.saveStateToHistory) {
                this.editor.saveStateToHistory();
            }

            // 既にcode要素内にいるかチェック
            let node = range.commonAncestorContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentElement;
            }
            const codeElement = node.closest('code');

            // pre内のcodeはコードブロックなので除外
            if (codeElement && codeElement.closest('pre') === null) {
                // 既にcode要素内の場合は、code要素を削除して内容を残す
                const codeParent = codeElement.parentElement;
                while (codeElement.firstChild) {
                    codeParent.insertBefore(codeElement.firstChild, codeElement);
                }
                codeElement.remove();
            } else {
                // 選択範囲のテキストを取得
                const selectedText = range.toString();
                const isCollapsed = range.collapsed;

                if (isCollapsed || selectedText.trim() === '') {
                    // カーソルのみの場合、空のcode要素を作成してカーソルを配置
                    const code = document.createElement('code');

                    // カーソル位置に空のテキストノードを挿入（後で削除できるようにするため）
                    const textNode = document.createTextNode('\u200B'); // ゼロ幅スペース
                    code.appendChild(textNode);

                    // カーソル位置にcode要素を挿入
                    range.insertNode(code);

                    // カーソルをcode要素内に配置
                    const newRange = document.createRange();
                    newRange.setStart(code, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } else {
                    // テキストが選択されている場合は、選択範囲をcode要素で囲む
                    // マーカーノードを使って挿入位置を保存
                    const startMarker = document.createComment('start');
                    const endMarker = document.createComment('end');

                    // マーカーを挿入
                    range.insertNode(startMarker);
                    range.collapse(false);
                    range.insertNode(endMarker);

                    // マーカー間のすべてのノードを取得
                    const nodesToWrap = [];
                    let currentNode = startMarker.nextSibling;

                    while (currentNode && currentNode !== endMarker) {
                        const nextNode = currentNode.nextSibling;
                        nodesToWrap.push(currentNode);
                        currentNode = nextNode;
                    }

                    // 新しいcode要素を作成
                    const code = document.createElement('code');

                    // ノードをcode要素に移動
                    nodesToWrap.forEach(node => {
                        // 既存のcode要素の場合は中身だけを取り出す（ネストを防ぐ）
                        if (node.nodeType === Node.ELEMENT_NODE &&
                            node.tagName === 'CODE' &&
                            node.closest('pre') === null) {
                            while (node.firstChild) {
                                code.appendChild(node.firstChild);
                            }
                        } else {
                            code.appendChild(node);
                        }
                    });

                    // マーカーの間にcode要素を挿入
                    startMarker.parentNode.insertBefore(code, startMarker);

                    // マーカーを削除
                    startMarker.remove();
                    endMarker.remove();

                    // 選択範囲を復元
                    const newRange = document.createRange();
                    newRange.selectNodeContents(code);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }

            // 変更後の状態を履歴に保存
            if (this.editor.saveStateToHistory) {
                this.editor.saveStateToHistory();
            }
        } catch (e) {
            console.error('インラインコードの適用でエラー:', e);
        }

        this.editor.updatePlaceholder();
        this.updateActiveState();
    }

    getBlockElementForAlign(range) {
        let node = range.startContainer;

        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }

        // ブロック要素を見つける
        while (node && node !== this.editor.editor && node !== document.body) {
            if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'LI', 'BLOCKQUOTE'].includes(node.tagName)) {
                return node;
            }
            node = node.parentElement;
        }

        return null;
    }

    getTextAlign(element) {
        if (!element) return null;

        // inlineスタイルが明示的に設定されているかチェック
        if (element.style.textAlign) {
            const textAlign = element.style.textAlign.trim();
            // 'start'は'left'として扱う
            if (textAlign === 'start' || textAlign === '') {
                return 'left';
            }
            return textAlign;
        }

        // inlineスタイルが設定されていない場合はnullを返す
        // （デフォルトのCSSスタイル（text-align: left）は明示的な設定とはみなさない）
        return null;
    }
}
