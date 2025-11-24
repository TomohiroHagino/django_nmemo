// pages/static/pages/js/features/custom-editor/toolbar.js
import { insertCodeBlock } from './syntax-highlight.js';

// ============================================================================
// 定数定義
// ============================================================================

export const BLOCK_ELEMENTS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'LI', 'BLOCKQUOTE'];

const TEXT_ALIGN_COMMANDS = ['justifyLeft', 'justifyCenter', 'justifyRight'];

const ALIGN_COMMAND_MAP = {
    'justifyLeft': 'left',
    'justifyCenter': 'center',
    'justifyRight': 'right'
};

const NODE_TYPE = {
    ELEMENT: Node.ELEMENT_NODE,
    TEXT: Node.TEXT_NODE
};

// ============================================================================
// Toolbar クラス
// ============================================================================

export class Toolbar {
    // ========================================================================
    // コンストラクタと初期化
    // ========================================================================
    
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
        this._initToolbarButtons();
    }

    // ========================================================================
    // ツールバーボタンの設定と初期化
    // ========================================================================
    

    /**
     * ツールバーボタンの設定配列を作成
     * @returns {Array<Object>} ボタン設定オブジェクトの配列
     */
    _createToolbarButtonConfigs() {
        return [
            // フォントサイズ
            { custom: 'fontSize', icon: '<strong>Aa</strong>', title: 'フォントサイズ' },
            { separator: true },
            // 見出し
            { command: 'formatBlock', value: '<h1>', icon: 'H₁', title: '見出し1' },
            { command: 'formatBlock', value: '<h2>', icon: 'H₂', title: '見出し2' },
            { command: 'formatBlock', value: '<h3>', icon: 'H₃', title: '見出し3' },
            { separator: true },
            // テキスト配置
            { command: 'justifyLeft', icon: '⬅️', title: '左寄せ' },
            { command: 'justifyCenter', icon: '↔️', title: '中央寄せ' },
            { command: 'justifyRight', icon: '➡️', title: '右寄せ' },
            { separator: true },
            // テキストスタイル
            { command: 'bold', icon: '<strong>B</strong>', title: '太字' },
            { command: 'italic', icon: '<em>I</em>', title: '斜体' },
            { command: 'underline', icon: '<u>U</u>', title: '下線' },
            { command: 'strikeThrough', icon: '<s>S</s>', title: '取り消し線' },
            { separator: true },
            // リスト
            { command: 'insertUnorderedList', icon: '☰', title: '箇条書き' },
            { command: 'insertOrderedList', icon: '1️⃣', title: '番号付きリスト' },
            { separator: true },
            // コード
            { custom: 'code', icon: '<code>&lt;/&gt;</code>i', title: 'インラインコード' },
            { custom: 'codeBlock', icon: '{ }', title: 'コードブロック（ハイライト）' },
            { custom: 'codeBlockNoHighlight', icon: '<code class="no-highlight-icon">{ }</code>', title: 'コードブロック（ハイライトなし）' },
            { separator: true },
            // 色
            { custom: 'color', icon: '<span class="color-icon-text">A</span>', title: '文字色' },
            { custom: 'background', icon: '<span class="color-icon-bg">A</span>', title: '背景色' },
            { separator: true },
            // 挿入
            { custom: 'link', icon: '🔗', title: 'リンク' },
            { custom: 'image', icon: '🖼️', title: '画像' },
            { custom: 'video', icon: '▶️', title: '動画' },
        ];
    }

    /**
     * ツールバーボタンを初期化
     */
    _initToolbarButtons() {
        const toolbarButtons = this._createToolbarButtonConfigs();
        toolbarButtons.forEach(buttonConfig => {
            if (buttonConfig.separator) {
                this.createSeparator();
            } else if (buttonConfig.custom) {
                this.addCustomButton(buttonConfig);
            } else {
                this.addButton(buttonConfig);
            }
        });
    }

    // ========================================================================
    // ボタンの追加と管理（パブリックメソッド）
    // ========================================================================

    /**
     * セパレータを作成
     */
    createSeparator() {
        const separator = document.createElement('span');
        separator.className = 'toolbar-separator';
        this.container.appendChild(separator);
    }

    /**
     * カスタムボタンを追加
     * @param {Object} buttonConfig - ボタン設定オブジェクト
     * @param {string} buttonConfig.custom - カスタムアクション名
     * @param {string} buttonConfig.icon - アイコン
     * @param {string} buttonConfig.title - ツールチップ
     */
    addCustomButton(buttonConfig) {
        const button = this._createCustomButton(buttonConfig);
        this.container.appendChild(button);
    }

    /**
     * 標準ボタンを追加
     * @param {Object} buttonConfig - ボタン設定オブジェクト
     */
    addButton(buttonConfig) {
        const button = this._createButton(buttonConfig);
        this.container.appendChild(button);
    }

    /**
     * すべてのボタンを非アクティブにする
     */
    deactivateAllButtons() {
        const buttons = this.container.querySelectorAll('.toolbar-btn[data-cmd], .toolbar-btn[data-custom]');
        buttons.forEach(button => button.classList.remove('active'));
    }

    /**
     * コマンドボタンの状態を更新
     * @param {Range} range - 選択範囲
     */
    updateCommandButtons(range) {
        const buttons = this.container.querySelectorAll('.toolbar-btn[data-cmd]');
        buttons.forEach(button => {
            const command = button.getAttribute('data-cmd');
            const value = button.getAttribute('data-value');

            try {
                if (command === 'formatBlock' && value) {
                    this._updateFormatBlockButton(button, value, range);
                } else if (this._isTextAlignCommand(command)) {
                    this._updateTextAlignButton(button, command, range);
                } else {
                    this._updateStandardCommandButton(button, command);
                }
            } catch (error) {
                // 一部のコマンドは状態を取得できない
                button.classList.remove('active');
            }
        });
    }


    /**
     * カスタムボタンの状態を更新
     * @param {Range} range - 選択範囲
     */
    updateCustomButtons(range) {
        const customButtons = this.container.querySelectorAll('.toolbar-btn[data-custom]');
        const commonAncestor = range.commonAncestorContainer;

        customButtons.forEach(button => {
            const custom = button.getAttribute('data-custom');

            if (custom === 'code') {
                this.updateCodeButton(button, commonAncestor);
            }
        });
    }

    /**
     * インラインコードボタンの状態を更新
     * @param {HTMLElement} button - ボタン要素
     * @param {Node} commonAncestor - 共通の祖先ノード
     */
    updateCodeButton(button, commonAncestor) {
        const node = commonAncestor.nodeType === Node.TEXT_NODE
            ? commonAncestor.parentElement
            : commonAncestor;

        // code要素内にいるかチェック
        const codeElement = node.closest('code');
        // pre内のcodeはコードブロックなので除外
        if (codeElement && codeElement.closest('pre') === null) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    /**
     * カスタムアクションを処理
     * @param {string} action - アクション名
     */
    handleCustomAction(action) {
        this.editor.editor.focus();

        const actionHandlers = {
            link: () => this._handleLink(),
            code: () => this._applyInlineCode(),
            codeBlock: () => insertCodeBlock(this.editor),
            codeBlockNoHighlight: () => insertCodeBlock(this.editor, '', true),
            image: () => this._handleImage(),
            video: () => this._handleVideo()
        };

        const handler = actionHandlers[action];
        if (handler) {
            handler();
        }

        this.editor.updatePlaceholder();
        this._updateActiveState();
    }
    

    /**
     * ドロップダウンラッパーを作成
     * @param {string} className - CSSクラス名
     * @returns {HTMLElement} ラッパー要素
     */
    createDropdownWrapper(className) {
        const wrapper = document.createElement('div');
        wrapper.className = className;
        return wrapper;
    }

    /**
     * 標準カスタムボタンを作成
     * @param {HTMLButtonElement} button - ベースボタン
     * @param {string} custom - カスタムアクション名
     * @returns {HTMLButtonElement} ボタン要素
     */
    createStandardCustomButton(button, custom) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCustomAction(custom);
        });
        return button;
    }

    // ========================================================================
    // ボタン作成（プライベートメソッド）
    // ========================================================================

    /**
     * 標準コマンドボタンを作成
     * @param {Object} buttonConfig - ボタン設定オブジェクト
     * @param {string} buttonConfig.command - コマンド名
     * @param {string} [buttonConfig.value] - コマンド値
     * @param {string} buttonConfig.icon - アイコン
     * @param {string} buttonConfig.title - ツールチップ
     * @returns {HTMLButtonElement} 作成されたボタン要素
     */
    _createButton({ command, value, icon, title }) {
        const button = this._createBaseButton(icon, title);
        this._setButtonAttributes(button, command, value);
        this._attachButtonClickHandler(button, command, value);
        return button;
    }

    /**
     * カスタムボタンを作成
     * @param {Object} buttonConfig - ボタン設定オブジェクト
     * @param {string} buttonConfig.custom - カスタムアクション名
     * @param {string} buttonConfig.icon - アイコン
     * @param {string} buttonConfig.title - ツールチップ
     * @returns {HTMLButtonElement} 作成されたボタン要素
     */
    _createCustomButton({ custom, icon, title }) {
        const button = this._createBaseButton(icon, title);
        button.setAttribute('data-custom', custom);

        const buttonCreators = {
            fontSize: () => this._createFontSizeButton(button, icon, title),
            color: () => this._createColorPickerButton(button, icon, title, custom),
            background: () => this._createColorPickerButton(button, icon, title, custom)
        };

        const creator = buttonCreators[custom];
        if (!creator) {
            return this.createStandardCustomButton(button, custom);
        }

        return creator();
    }

    /**
     * ボタンに属性を設定
     * @param {HTMLButtonElement} button - ボタン要素
     * @param {string} command - コマンド名
     * @param {string|null} value - コマンド値
     */
    _setButtonAttributes(button, command, value) {
        button.setAttribute('data-cmd', command);
        if (value) {
            button.setAttribute('data-value', value);
        }
    }

    /**
     * ボタンにクリックイベントハンドラを設定
     * @param {HTMLButtonElement} button - ボタン要素
     * @param {string} command - コマンド名
     * @param {string|null} value - コマンド値
     */
    _attachButtonClickHandler(button, command, value) {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            this._executeCommand(command, value);
            this._updateEditorState();
        });
    }

    /**
     * ベースボタンを作成
     * @param {string} icon - アイコン（HTMLまたはテキスト）
     * @param {string} title - ツールチップ
     * @returns {HTMLButtonElement} 作成されたボタン要素
     */
    _createBaseButton(icon, title) {
        const HTML_TAG_PATTERN = /<[^>]+>/;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toolbar-btn';

        // HTMLタグが含まれているかどうかで判定
        const containsHtmlTags = HTML_TAG_PATTERN.test(icon);
        if (containsHtmlTags) {
            button.innerHTML = icon;
        } else {
            button.textContent = icon;
        }

        button.title = title;
        return button;
    }

    // ========================================================================
    // フォントサイズドロップダウン管理
    // ========================================================================
    

    /**
     * フォントサイズドロップダウンを開閉
     * @param {HTMLElement} wrapper - ドロップダウンのラッパー要素
     * @param {HTMLElement} button - ボタン要素
     */
    toggleFontSizeDropdown(wrapper, button) {
        if (this.fontSizeDropdown && this.fontSizeDropdown.parentElement === wrapper) {
            this.closeFontSizeDropdown();
            return;
        }

        this.closeFontSizeDropdown();
        this.closeColorPicker();

        // ドロップダウンを開く前に選択範囲を保存
        const savedRangeBeforeOpen = this._saveSelectionRange();

        const dropdown = document.createElement('div');
        dropdown.className = 'font-size-dropdown';

        const FONT_SIZES = [
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
        FONT_SIZES.forEach(size => {
            const option = this._createFontSizeOption(size, savedRangeBeforeOpen);
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

    /**
     * フォントサイズドロップダウンをセットアップ
     * @param {HTMLElement} wrapper - ラッパー要素
     * @param {HTMLElement} button - ボタン要素
     */
    setupFontSizeDropdown(wrapper, button) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleFontSizeDropdown(wrapper, button);
        });

        // 外部クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                this.closeFontSizeDropdown();
            }
        });
    }

    /**
     * フォントサイズオプションのハンドラをアタッチ
     * @param {HTMLElement} option - オプション要素
     * @param {string} size - フォントサイズ値
     * @param {Range|null} savedRange - 保存された選択範囲
     */
    attachFontSizeOptionHandlers(option, size, savedRange) {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyFontSize(size, savedRange);
            this.closeFontSizeDropdown();
        });
    }

    /**
     * フォントサイズを適用
     * @param {string} size - フォントサイズ値
     * @param {Range|null} savedRange - 保存された選択範囲
     */
    applyFontSize(size, savedRange = null) {
        this._applyStyleToSelection({
            applyStyle: (spanElement) => {
                spanElement.style.fontSize = size;
            },
            shouldUnwrapNode: (element) => this._isFontSizeSpanElement(element),
            errorMessage: 'フォントサイズの適用でエラー:'
        }, savedRange);
    }

    /**
     * フォントサイズボタンを作成
     * @param {HTMLButtonElement} button - ベースボタン
     * @param {string} icon - アイコン
     * @param {string} title - ツールチップ
     * @returns {HTMLElement} ラッパー要素
     */
    _createFontSizeButton(button, icon, title) {
        const wrapper = this.createDropdownWrapper('font-size-wrapper');
        button.innerHTML = icon;
        button.title = title;
        wrapper.appendChild(button);

        this.setupFontSizeDropdown(wrapper, button);
        return wrapper;
    }

    /**
     * カラーピッカーボタンを作成
     * @param {HTMLButtonElement} button - ベースボタン
     * @param {string} icon - アイコン
     * @param {string} title - ツールチップ
     * @param {string} colorType - カラータイプ ('color' または 'background')
     * @returns {HTMLElement} ラッパー要素
     */
    _createColorPickerButton(button, icon, title, colorType) {
        const wrapper = this.createDropdownWrapper('color-picker-wrapper');
        button.innerHTML = icon;
        button.title = title;
        wrapper.appendChild(button);

        this.setupColorPickerDropdown(wrapper, button, colorType);
        return wrapper;
    }

    /**
     * フォントサイズオプションを作成
     * @param {Object} size - フォントサイズ設定オブジェクト
     * @param {string} size.value - フォントサイズ値
     * @param {string} size.label - 表示ラベル
     * @param {Range|null} savedRange - 保存された選択範囲
     * @returns {HTMLElement} フォントサイズオプション要素
     */
    _createFontSizeOption(size, savedRange) {
        const option = document.createElement('div');
        option.className = 'font-size-option';
        option.style.fontSize = size.value;
        option.textContent = size.label;
        option.dataset.value = size.value;

        this.attachFontSizeOptionHandlers(option, size.value, savedRange);
        return option;
    }

    // ========================================================================
    // カラーピッカードロップダウン管理
    // ========================================================================
    

    toggleColorPicker(wrapper, button, colorType) {
        if (this.isColorPickerOpen(wrapper)) {
            this.closeColorPicker();
            return;
        }

        this.closeAllDropdowns();
        const savedRange = this._saveSelectionRange();
        const dropdown = this._createColorPickerDropdown(colorType, savedRange);
        this._attachColorPickerToWrapper(wrapper, dropdown, colorType);
    }

    closeColorPicker() {
        if (this.colorDropdown) {
            this.colorDropdown.remove();
            this.colorDropdown = null;
            this.colorPickerType = null;
        }
    }

    /**
     * カラーピッカードロップダウンをセットアップ
     * @param {HTMLElement} wrapper - ラッパー要素
     * @param {HTMLElement} button - ボタン要素
     * @param {string} colorType - カラータイプ
     */
    setupColorPickerDropdown(wrapper, button, colorType) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleColorPicker(wrapper, button, colorType);
        });

        // 外部クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                this.closeColorPicker();
            }
        });
    }

    /**
     * カラーピッカーが開いているかどうかを判定
     * @param {HTMLElement} wrapper - ラッパー要素
     * @returns {boolean} 開いている場合true
     */
    isColorPickerOpen(wrapper) {
        return this.colorDropdown && this.colorDropdown.parentElement === wrapper;
    }

    /**
     * すべてのドロップダウンを閉じる
     */
    closeAllDropdowns() {
        this.closeFontSizeDropdown();
        this.closeColorPicker();
    }

    /**
     * カラーピッカーをラッパーにアタッチ
     * @param {HTMLElement} wrapper - ラッパー要素
     * @param {HTMLElement} dropdown - ドロップダウン要素
     * @param {string} colorType - カラータイプ
     */
    _attachColorPickerToWrapper(wrapper, dropdown, colorType) {
        wrapper.appendChild(dropdown);
        this.colorDropdown = dropdown;
        this.colorPickerType = colorType;
    }

    /**
     * カラーボタンを作成
     * @param {string} color - カラー値
     * @param {string} type - カラータイプ
     * @param {Range|null} savedRange - 保存された選択範囲
     * @returns {HTMLElement} カラーボタン要素
     */
    _createColorButton(color, type, savedRange) {
        const LIGHT_COLORS_NEEDING_BORDER = ['#FFFFFF', '#CCCCCC', '#FFCC00', '#99FF00', '#00FFCC'];

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'color-picker-btn';
        button.style.backgroundColor = color;

        if (LIGHT_COLORS_NEEDING_BORDER.includes(color)) {
            button.style.border = '1px solid #ccc';
        }

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyColor(color, type, savedRange);
            this.closeColorPicker();
        });

        return button;
    }

    /**
     * カラーピッカードロップダウンを作成
     * @param {string} type - カラータイプ
     * @param {Range|null} savedRange - 保存された選択範囲
     * @returns {HTMLElement} ドロップダウン要素
     */
    _createColorPickerDropdown(type, savedRange) {
        const dropdown = document.createElement('div');
        dropdown.className = 'color-picker-dropdown';

        const grid = this._createColorGrid(type, savedRange);
        const customSection = this._createCustomColorSection(type, savedRange);

        dropdown.appendChild(grid);
        dropdown.appendChild(customSection);

        return dropdown;
    }

    /**
     * カラーピッカーのグリッドを作成
     * @param {string} type - カラータイプ
     * @param {Range|null} savedRange - 保存された選択範囲
     * @returns {HTMLElement} グリッド要素
     */
    _createColorGrid(type, savedRange) {
        const grid = document.createElement('div');
        grid.className = 'color-picker-grid';

        const COLOR_PALETTE = [
            '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
            '#FF0000', '#FF6600', '#FFCC00', '#99FF00', '#00FF00', '#00FFCC',
            '#0099FF', '#0066FF', '#6600FF', '#CC00FF', '#FF0099', '#FF0066',
            '#990000', '#CC6600', '#999900', '#669900', '#009900', '#009999',
            '#006699', '#003399', '#660099', '#9900CC', '#CC0099', '#CC0066'
        ];
        COLOR_PALETTE.forEach(color => {
            const colorButton = this._createColorButton(color, type, savedRange);
            grid.appendChild(colorButton);
        });

        return grid;
    }

    /**
     * カスタムカラーセクションを作成
     * @param {string} type - カラータイプ
     * @param {Range|null} savedRange - 保存された選択範囲
     * @returns {HTMLElement} カスタムカラーセクション要素
     */
    _createCustomColorSection(type, savedRange) {
        const section = document.createElement('div');
        section.className = 'color-picker-custom';

        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'color-picker-input';

        input.addEventListener('change', (e) => {
            const color = e.target.value;
            this.applyColor(color, type, savedRange);
            this.closeColorPicker();
        });

        section.appendChild(input);
        return section;
    }

    // ========================================================================
    // コマンド実行
    // ========================================================================
    

    /**
     * コマンドを実行
     * @param {string} command - コマンド名
     * @param {string|null} value - コマンド値
     */
    _executeCommand(command, value) {
        this.editor.editor.focus();

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        if (this._isTextAlignCommand(command)) {
            this._executeTextAlignCommand(command, range);
        } else {
            document.execCommand(command, false, value || null);
        }
    }

    /**
     * テキスト配置コマンドを実行
     * @param {string} command - コマンド名 (justifyLeft, justifyCenter, justifyRight)
     * @param {Range} range - 選択範囲
     */
    _executeTextAlignCommand(command, range) {
        const blockElement = this._getBlockElementForAlign(range);
        if (!blockElement) {
            // ブロック要素が見つからない場合は通常通り実行
            document.execCommand(command, false, null);
            return;
        }

        const currentAlign = this._getTextAlign(blockElement);
        const targetAlign = ALIGN_COMMAND_MAP[command];

        // 既に同じ配置が適用されている場合は解除（左寄せに戻す）
        if (currentAlign === targetAlign) {
            this._removeTextAlign(blockElement);
        } else {
            // 異なる配置を適用
            document.execCommand(command, false, null);
        }
    }

    /**
     * リンクを処理
     */
    _handleLink() {
        const url = prompt('リンクのURLを入力してください:', 'https://');
        if (!url) {
            return;
        }
        document.execCommand('createLink', false, url);
    }

    /**
     * 画像を処理
     */
    _handleImage() {
        if (!this.editor.onImageClick) {
            return;
        }
        this.editor.onImageClick();
    }

    /**
     * 動画を処理
     */
    _handleVideo() {
        if (!this.editor.onVideoClick) {
            return;
        }
        this.editor.onVideoClick();
    }

    /**
     * インラインコードを適用
     */
    _applyInlineCode() {
        this.editor.editor.focus();

        const range = this._getValidRange();
        if (!range) return;

        try {
            this._saveEditorState();

            if (this._isInsideInlineCode(range)) {
                this._removeInlineCode(range);
            } else {
                this._wrapSelectionWithCode(range);
            }

            this._saveEditorState();
        } catch (error) {
            console.error('インラインコードの適用でエラー:', error);
        }

        this.editor.updatePlaceholder();
        this._updateActiveState();
    }

    // ========================================================================
    // スタイル適用
    // ========================================================================

    /**
     * 選択範囲にスタイルを適用する共通メソッド
     * @param {Object} styleConfig - スタイル設定オブジェクト
     * @param {Function} styleConfig.applyStyle - span要素にスタイルを適用する関数
     * @param {Function} styleConfig.shouldUnwrapNode - 既存のノードを展開すべきか判定する関数
     * @param {string} styleConfig.errorMessage - エラーメッセージ
     * @param {Range|null} savedRange - 保存された選択範囲
     */
    _applyStyleToSelection(styleConfig, savedRange = null) {
        this.editor.editor.focus();

        const range = this._getValidRange(savedRange);
        if (!range) return;

        if (!this._hasSelectedText(range)) return;

        try {
            this._saveEditorState();
            this._applyStyleWithMarkers(range, styleConfig);
            this._saveEditorState();
            this._updateEditorState();
        } catch (error) {
            console.error(styleConfig.errorMessage, error);
        }
    }

    /**
     * 選択範囲が有効かどうかを判定
     * @returns {boolean} 選択範囲が有効な場合true
     */
    hasValidSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return false;
        }

        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;

        const ancestorElement = commonAncestor.nodeType === NODE_TYPE.TEXT
            ? commonAncestor.parentElement
            : commonAncestor;

        return this.editor.editor.contains(ancestorElement);
    }

    /**
     * 選択範囲を保存
     * @returns {Range|null} 保存された範囲、保存できない場合はnull
     */
    _saveSelectionRange() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (this.editor.editor.contains(range.commonAncestorContainer)) {
                return range.cloneRange();
            }
        }
        return null;
    }


    /**
     * 有効な選択範囲を取得
     * @param {Range|null} savedRange - 保存された選択範囲（オプション）
     * @returns {Range|null} 有効な選択範囲、取得できない場合はnull
     */
    _getValidRange(savedRange = null) {
        // 保存された範囲が提供されている場合はそれを使用
        if (savedRange) {
            // 保存された範囲がまだエディタ内に有効かチェック
            if (this.editor.editor.contains(savedRange.commonAncestorContainer)) {
                return savedRange;
            }
        }

        // 保存された範囲がない、または無効な場合は現在の選択範囲を取得
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;

        // エディタ内に有効な範囲かチェック
        const ancestorElement = commonAncestor.nodeType === NODE_TYPE.TEXT
            ? commonAncestor.parentElement
            : commonAncestor;

        if (!this.editor.editor.contains(ancestorElement)) {
            return null;
        }

        return range;
    }

    /**
     * 範囲内のブロック要素を取得
     * @param {Range} range - 選択範囲
     * @returns {HTMLElement|null} ブロック要素、見つからない場合はnull
     */
    _getBlockElement(range) {
        let currentNode = range.startContainer;

        if (currentNode.nodeType === NODE_TYPE.TEXT) {
            currentNode = currentNode.parentElement;
        }

        while (currentNode && currentNode !== this.editor.editor && currentNode !== document.body) {
            if (BLOCK_ELEMENTS.includes(currentNode.tagName)) {
                return currentNode;
            }
            currentNode = currentNode.parentElement;
        }

        return null;
    }

    /**
     * 現在のブロックタグを取得
     * @param {Range} range - 選択範囲
     * @returns {string|null} ブロックタグ名、見つからない場合はnull
     */
    _getCurrentBlockTag(range) {
        const blockElement = this._getBlockElement(range);
        return blockElement ? blockElement.tagName : null;
    }

    _getBlockElementForAlign(range) {
        return this._getBlockElement(range);
    }

    /**
     * 選択範囲を復元
     * @param {HTMLElement} element - 対象要素
     */
    _restoreSelection(element) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * エディタの状態を保存
     */
    _saveEditorState() {
        if (this.editor.saveStateToHistory) {
            this.editor.saveStateToHistory();
        }
    }

    /**
     * 要素のテキスト配置を取得
     * @param {HTMLElement|null} element - 対象要素
     * @returns {string|null} テキスト配置値、取得できない場合はnull
     */
    _getTextAlign(element) {
        const TEXT_ALIGN_VALUES = {
            START: 'start',
            LEFT: 'left',
            EMPTY: ''
        };

        if (!element) return null;

        const textAlignValue = element.style.textAlign?.trim();
        if (!textAlignValue) return null;

        if (textAlignValue === TEXT_ALIGN_VALUES.START || textAlignValue === TEXT_ALIGN_VALUES.EMPTY) {
            return TEXT_ALIGN_VALUES.LEFT;
        }

        return textAlignValue;
    }

    /**
     * テキスト配置コマンドかどうかを判定
     * @param {string} command - コマンド名
     * @returns {boolean} テキスト配置コマンドの場合true
     */
    _isTextAlignCommand(command) {
        return TEXT_ALIGN_COMMANDS.includes(command);
    }

    /**
     * 見出しボタン（formatBlock）の状態を更新
     * @param {HTMLElement} button - ボタン要素
     * @param {string} value - ボタンの値（例: '<h1>'）
     */
    _updateFormatBlockButton(button, value, range) {
        const blockTag = value.replace(/[<>]/g, '').toLowerCase();
        const currentBlockTag = this._getCurrentBlockTag(range);

        if (currentBlockTag && currentBlockTag.toLowerCase() === blockTag) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    /**
     * テキスト配置ボタンの状態を更新
     * @param {HTMLElement} button - ボタン要素
     * @param {string} command - コマンド名
     * @param {Range} range - 選択範囲
     */
    _updateTextAlignButton(button, command, range) {
        const blockElement = this._getBlockElementForAlign(range);
        const textAlign = this._getTextAlign(blockElement);

        // 明示的にtext-alignが設定されていない場合は、どのボタンもアクティブにしない
        if (textAlign === null) {
            button.classList.remove('active');
            return;
        }

        const targetAlign = this.getTargetAlignFromCommand(command);
        if (textAlign === targetAlign) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    /**
     * コマンド名から対象の配置値を取得
     * @param {string} command - コマンド名
     * @returns {string} 配置値（'left', 'center', 'right'）
     */
    getTargetAlignFromCommand(command) {
        return ALIGN_COMMAND_MAP[command] || 'left';
    }

    /**
     * 通常のコマンドボタン（bold, italic, underlineなど）の状態を更新
     * @param {HTMLElement} button - ボタン要素
     * @param {string} command - コマンド名
     */
    _updateStandardCommandButton(button, command) {
        if (document.queryCommandState(command)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    // ========================================================================
    // スタイル適用
    // ========================================================================

    /**
     * マーカーを挿入
     * @param {Range} range - 選択範囲
     * @returns {Object} startMarker と endMarker を含むオブジェクト
     */
    _insertMarkers(range) {
        const startMarker = document.createTextNode('\u200B');
        const endMarker = document.createTextNode('\u200B');

        range.insertNode(startMarker);
        range.collapse(false);
        range.insertNode(endMarker);

        return { startMarker, endMarker };
    }

    /**
     * マーカー間のノードを収集
     * @param {Node} startMarker - 開始マーカー
     * @param {Node} endMarker - 終了マーカー
     * @returns {Array<Node>} ノード配列
     */
    _collectNodesBetweenMarkers(startMarker, endMarker) {
        const nodes = [];
        let currentNode = startMarker.nextSibling;

        while (currentNode && currentNode !== endMarker) {
            const nextSibling = currentNode.nextSibling;
            nodes.push(currentNode);
            currentNode = nextSibling;
        }

        return nodes;
    }

    /**
     * スタイル付きSPAN要素を作成
     * @param {Object} styleConfig - スタイル設定
     * @param {Array<Node>} nodesToWrap - ラップするノード
     * @returns {HTMLSpanElement} SPAN要素
     */
    _createStyledSpan(styleConfig, nodesToWrap) {
        const span = document.createElement('span');

        nodesToWrap.forEach(node => {
            if (styleConfig.shouldUnwrapNode && styleConfig.shouldUnwrapNode(node)) {
                // 既存のスタイル要素を展開
                while (node.firstChild) {
                    span.appendChild(node.firstChild);
                }
            } else {
                span.appendChild(node);
            }
        });

        styleConfig.applyStyle(span);
        return span;
    }

    /**
     * マーカーを使用してスタイルを適用
     * @param {Range} range - 選択範囲
     * @param {Object} styleConfig - スタイル設定オブジェクト
     */
    _applyStyleWithMarkers(range, styleConfig) {
        // マーカーを挿入して選択範囲をマーク
        const { startMarker, endMarker } = this._insertMarkers(range);
        
        // マーカー間のノードを収集
        const nodesToWrap = this._collectNodesBetweenMarkers(startMarker, endMarker);
        
        // ノードがない場合は何もしない
        if (nodesToWrap.length === 0) {
            startMarker.remove();
            endMarker.remove();
            return;
        }
        
        // スタイル付きSPAN要素を作成
        const styledSpan = this._createStyledSpan(styleConfig, nodesToWrap);
        
        // マーカーを削除してSPANを挿入
        startMarker.parentNode.insertBefore(styledSpan, startMarker);
        startMarker.remove();
        endMarker.remove();
        
        // 選択範囲をSPAN要素に復元
        const newRange = document.createRange();
        newRange.selectNodeContents(styledSpan);
        this._restoreSelection(newRange);
    }

    /**
     * 選択範囲を復元
     * @param {Range} range - 選択範囲
     */
    _restoreSelection(range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // ========================================================================
    // 選択範囲操作
    // ========================================================================

    /**
     * 現在の選択範囲を取得
     * @returns {Range|null} 選択範囲、取得できない場合はnull
     */
    _getSelectionRange() {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return null;
        }

        return selection.getRangeAt(0);
    }

    /**
     * インラインコード内にいるかどうかを判定
     * @param {Range} range - 選択範囲
     * @returns {boolean} インラインコード内の場合true
     */
    _isInsideInlineCode(range) {
        const elementNode = this._getElementNodeFromRange(range);
        const codeElement = elementNode.closest('code');
        return codeElement && codeElement.closest('pre') === null;
    }

    /**
     * インラインコードを削除
     * @param {Range} range - 選択範囲
     */
    _removeInlineCode(range) {
        const elementNode = this._getElementNodeFromRange(range);
        const codeElement = elementNode.closest('code');
        if (!codeElement) {
            return;
        }

        const codeParent = codeElement.parentElement;
        while (codeElement.firstChild) {
            codeParent.insertBefore(codeElement.firstChild, codeElement);
        }
        codeElement.remove();
    }

    /**
     * 範囲から要素ノードを取得
     * @param {Range} range - 選択範囲
     * @returns {HTMLElement} 要素ノード
     */
    _getElementNodeFromRange(range) {
        let currentNode = range.commonAncestorContainer;
        if (currentNode.nodeType === NODE_TYPE.TEXT) {
            currentNode = currentNode.parentElement;
        }
        return currentNode;
    }

    /**
     * 選択テキストをコード要素でラップ
     * @param {Range} range - 選択範囲
     */
    _wrapSelectedTextWithCode(range) {
        const { startMarker, endMarker } = this._insertMarkers(range);
        const nodesToWrap = this._collectNodesBetweenMarkers(startMarker, endMarker);
        const code = this._createCodeElement(nodesToWrap);

        startMarker.parentNode.insertBefore(code, startMarker);
        startMarker.remove();
        endMarker.remove();

        this._restoreSelectionToCode(code);
    }

    /**
     * 空のコード要素を作成
     * @param {Range} range - 選択範囲
     */
    _createEmptyCodeElement(range) {
        const ZERO_WIDTH_SPACE = '\u200B';

        const code = document.createElement('code');
        const textNode = document.createTextNode(ZERO_WIDTH_SPACE);
        code.appendChild(textNode);
        range.insertNode(code);

        const selection = window.getSelection();
        const newRange = document.createRange();
        newRange.setStart(code, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    /**
     * コード要素を作成
     * @param {Array<Node>} nodesToWrap - ラップするノード配列
     * @returns {HTMLCodeElement} 作成されたコード要素
     */
    _createCodeElement(nodesToWrap) {
        const code = document.createElement('code');
        nodesToWrap.forEach(node => {
            if (this._isInlineCodeElement(node)) {
                while (node.firstChild) {
                    code.appendChild(node.firstChild);
                }
            } else {
                code.appendChild(node);
            }
        });
        return code;
    }

    /**
     * インラインコード要素かどうかを判定
     * @param {Node} node - 判定するノード
     * @returns {boolean} インラインコード要素の場合true
     */
    _isInlineCodeElement(node) {
        return node.nodeType === Node.ELEMENT_NODE &&
            node.tagName === 'CODE' &&
            node.closest('pre') === null;
    }

    /**
     * 選択範囲をコード要素に復元
     * @param {HTMLCodeElement} code - コード要素
     */
    _restoreSelectionToCode(code) {
        const selection = window.getSelection();
        const newRange = document.createRange();
        newRange.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    // ========================================================================
    // 状態更新・判定
    // ========================================================================
    

    /**
     * 現在の選択範囲を取得
     * @returns {Range|null} 選択範囲、取得できない場合はnull
     */
    _getSelectionRange() {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return null;
        }

        return selection.getRangeAt(0);
    }

    /**
     * テキスト配置コマンドかどうかを判定
     * @param {string} command - コマンド名
     * @returns {boolean} テキスト配置コマンドの場合true
     */
    _isTextAlignCommand(command) {
        return TEXT_ALIGN_COMMANDS.includes(command);
    }

    /**
     * カラースタイルを持つSPAN要素かどうかを判定
     * @param {Node} element - 判定する要素
     * @returns {boolean} カラースタイルを持つSPAN要素の場合true
     */
    _isColorSpanElement(element) {
        return element.nodeType === Node.ELEMENT_NODE &&
            element.tagName === 'SPAN' &&
            (element.style.color || element.style.backgroundColor);
    }

    /**
     * フォントサイズスタイルを持つSPAN要素かどうかを判定
     * @param {Node} element - 判定する要素
     * @returns {boolean} フォントサイズスタイルを持つSPAN要素の場合true
     */
    _isFontSizeSpanElement(element) {
        return element.nodeType === Node.ELEMENT_NODE &&
            element.tagName === 'SPAN' &&
            element.style.fontSize;
    }

    /**
     * インラインコード要素かどうかを判定
     * @param {Node} node - 判定するノード
     * @returns {boolean} インラインコード要素の場合true
     */
    _isInlineCodeElement(node) {
        return node.nodeType === Node.ELEMENT_NODE &&
            node.tagName === 'CODE' &&
            node.closest('pre') === null;
    }

    /**
     * テキスト配置を削除
     * @param {HTMLElement} element - 対象要素
     */
    _removeTextAlign(element) {
        element.style.textAlign = '';
        // style属性が空の場合は削除
        const styleAttr = element.getAttribute('style');
        if (!styleAttr || styleAttr.trim() === '') {
            element.removeAttribute('style');
        }
    }

    /**
     * カラースタイルを適用
     * @param {string} color - カラー値
     * @param {string} colorType - カラータイプ
     * @param {Range|null} savedRange - 保存された選択範囲
     */
    applyColor(color, colorType, savedRange = null) {
        this._applyStyleToSelection({
            applyStyle: (spanElement) => {
                if (colorType === 'color') {
                    spanElement.style.color = color;
                } else if (colorType === 'background') {
                    spanElement.style.backgroundColor = color;
                }
            },
            shouldUnwrapNode: (element) => this._isColorSpanElement(element),
            errorMessage: 'カラーの適用でエラー:'
        }, savedRange);
    }

    /**
     * フォントサイズを適用
     * @param {string} size - フォントサイズ値
     * @param {Range|null} savedRange - 保存された選択範囲
     */
    applyFontSize(size, savedRange = null) {
        this._applyStyleToSelection({
            applyStyle: (spanElement) => {
                spanElement.style.fontSize = size;
            },
            shouldUnwrapNode: (element) => this._isFontSizeSpanElement(element),
            errorMessage: 'フォントサイズの適用でエラー:'
        }, savedRange);
    }

    // ========================================================================
    // ユーティリティ
    // ========================================================================

    /**
     * 選択範囲が有効かどうかを判定
     * @returns {boolean} 選択範囲が有効な場合true
     */
    _hasSelectedText(range) {
        return range.toString().trim().length > 0;
    }

    /**
     * エディタの状態を更新
     */
    _updateEditorState() {
        this.editor.updatePlaceholder();
        this._updateActiveState();
    }

    /**
     * ボタンのアクティブ状態を更新
     */
    _updateActiveState() {
        const range = this._getSelectionRange();
        if (!range) {
            this.deactivateAllButtons();
            return;
        }

        // エディタ内に有効な範囲かチェック
        const commonAncestor = range.commonAncestorContainer;
        const ancestorElement = commonAncestor.nodeType === NODE_TYPE.TEXT
            ? commonAncestor.parentElement
            : commonAncestor;

        if (!this.editor.editor.contains(ancestorElement)) {
            this.deactivateAllButtons();
            return;
        }

        // コマンドボタンとカスタムボタンの状態を更新
        this.updateCommandButtons(range);
        this.updateCustomButtons(range);
    }

    /**
     * すべてのボタンを非アクティブにする
     */
    deactivateAllButtons() {
        const buttons = this.container.querySelectorAll('.toolbar-btn[data-cmd], .toolbar-btn[data-custom]');
        buttons.forEach(button => button.classList.remove('active'));
    }

    /**
     * コマンドボタンの状態を更新
     * @param {Range} range - 選択範囲
     */
    updateCommandButtons(range) {
        const buttons = this.container.querySelectorAll('.toolbar-btn[data-cmd]');
        buttons.forEach(button => {
            const command = button.getAttribute('data-cmd');
            const value = button.getAttribute('data-value');

            try {
                if (command === 'formatBlock' && value) {
                    this._updateFormatBlockButton(button, value, range);
                } else if (this._isTextAlignCommand(command)) {
                    this._updateTextAlignButton(button, command, range);
                } else {
                    this._updateStandardCommandButton(button, command);
                }
            } catch (error) {
                // 一部のコマンドは状態を取得できない
                button.classList.remove('active');
            }
        });
    }


    /**
     * カスタムボタンの状態を更新
     * @param {Range} range - 選択範囲
     */
    updateCustomButtons(range) {
        const customButtons = this.container.querySelectorAll('.toolbar-btn[data-custom]');
        const commonAncestor = range.commonAncestorContainer;

        customButtons.forEach(button => {
            const custom = button.getAttribute('data-custom');

            if (custom === 'code') {
                this.updateCodeButton(button, commonAncestor);
            }
        });
    }

    /**
     * インラインコードボタンの状態を更新
     * @param {HTMLElement} button - ボタン要素
     * @param {Node} commonAncestor - 共通の祖先ノード
     */
    updateCodeButton(button, commonAncestor) {
        const node = commonAncestor.nodeType === Node.TEXT_NODE
            ? commonAncestor.parentElement
            : commonAncestor;

        // code要素内にいるかチェック
        const codeElement = node.closest('code');
        // pre内のcodeはコードブロックなので除外
        if (codeElement && codeElement.closest('pre') === null) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    /**
     * カスタムアクションを処理
     * @param {string} action - アクション名
     */
    handleCustomAction(action) {
        this.editor.editor.focus();

        const actionHandlers = {
            link: () => this._handleLink(),
            code: () => this._applyInlineCode(),
            codeBlock: () => insertCodeBlock(this.editor),
            codeBlockNoHighlight: () => insertCodeBlock(this.editor, '', true),
            image: () => this._handleImage(),
            video: () => this._handleVideo()
        };

        const handler = actionHandlers[action];
        if (handler) {
            handler();
        }

        this.editor.updatePlaceholder();
        this._updateActiveState();
    }

    /**
     * ドロップダウンラッパーを作成
     * @param {string} className - CSSクラス名
     * @returns {HTMLElement} ラッパー要素
     */
    createDropdownWrapper(className) {
        const wrapper = document.createElement('div');
        wrapper.className = className;
        return wrapper;
    }

    /**
     * 標準カスタムボタンを作成
     * @param {HTMLButtonElement} button - ベースボタン
     * @param {string} custom - カスタムアクション名
     * @returns {HTMLButtonElement} ボタン要素
     */
    createStandardCustomButton(button, custom) {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCustomAction(custom);
        });
        return button;
    }
}
