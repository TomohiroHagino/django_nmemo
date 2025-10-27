// Quill エディタの初期化と画像/動画ハンドリング

import { registerVideoBlot } from './quill_editor_modules/videoBlot.js';
import { videoHandler, imageHandler } from './quill_editor_modules/handlers.js';
import { addDragDropImageUpload, addDragDropVideoUpload } from './quill_editor_modules/dragDrop.js';
import { addImageResizeHandlers } from './quill_editor_modules/imageResize.js';
import { addLinkShortcuts } from './quill_editor_modules/shortcuts.js';

// VideoBlot を登録
registerVideoBlot();

// 新規ページ作成用の Quill エディタを初期化
export function initCreateEditor(imageHandlerFn, videoHandlerFn, addImageResizeHandlersFn, addDragDropImageUploadFn, addDragDropVideoUploadFn) {
    // カスタムフォントサイズを登録
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
    Quill.register(Size, true);
    
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        ['code', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
    ];
    
    // 利用可能なら Image Resize モジュールを登録
    if (window.ImageResize) {
        Quill.register('modules/imageResize', window.ImageResize.default);
    }
    
    const createQuill = new Quill('#createEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandlerFn,
                    video: videoHandlerFn
                }
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize']
            }
        },
        placeholder: 'コンテンツを入力してください...'
    });
    
    // 既定のフォントサイズを 16px に設定
    createQuill.format('size', '16px');
    
    // ツールバーのサイズピッカー表示を 16px に合わせる
    setTimeout(() => {
        const toolbar = createQuill.getModule('toolbar');
        const container = toolbar.container;
        const sizePicker = container.querySelector('.ql-size');
        if (sizePicker) {
            const pickerLabel = sizePicker.querySelector('.ql-picker-label');
            if (pickerLabel) {
                // data-value 属性を設定（CSS の ::before で表示される）
                pickerLabel.setAttribute('data-value', '16px');
            }
        }
    }, 0);
    
    // テキスト入力時、サイズ未指定の範囲には 16px を適用
    createQuill.on('text-change', function(delta, oldDelta, source) {
        if (source === 'user') {
            const selection = createQuill.getSelection();
            if (selection) {
                const format = createQuill.getFormat(selection.index);
                // サイズが未設定なら 16px を適用
                if (!format.size) {
                    createQuill.formatText(selection.index, 0, 'size', '16px');
                }
            }
        }
    });
    
    // 簡易対処: Quillエディターのツールチップ（リンク入力ダイアログなど）がサイドバーの後ろに隠れてしまう問題を解決する
    // 要素は動かさずに z-index だけ大きくする
    setTimeout(() => {
        const container = document.querySelector('#createEditor.ql-container');
        if (!container) return;
        
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        
        // 非常に高い z-index を設定
        tooltip.style.setProperty('z-index', '100000', 'important');
    }, 100);
    
    // 画像リサイズ用のカスタムハンドラを追加
    addImageResizeHandlersFn(createQuill);
    
    // 画像のドラッグ＆ドロップアップロードを追加
    addDragDropImageUploadFn(createQuill, true);
    
    // 動画のドラッグ＆ドロップアップロードを追加
    addDragDropVideoUploadFn(createQuill, true);
    
    // リンクのキーボードショートカット（Ctrl+K / Cmd+K）と自動リンク検出を追加
    addLinkShortcuts(createQuill);
    
    return createQuill;
}

// 既存ページの表示・編集用 Quill エディタを初期化
export function initContentEditor(initialContent, imageHandlerFn, videoHandlerFn, addImageResizeHandlersFn, addDragDropImageUploadFn, addDragDropVideoUploadFn) {
    // カスタムフォントサイズを登録
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
    Quill.register(Size, true);
    
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        ['code', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
    ];
    
    // 利用可能なら Image Resize モジュールを登録
    if (window.ImageResize) {
        Quill.register('modules/imageResize', window.ImageResize.default);
    }
    
    const contentQuill = new Quill('#contentEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandlerFn,
                    video: videoHandlerFn
                }
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize']
            }
        },
        placeholder: 'コンテンツを入力してください...'
    });
    
    // 簡易対処: Quillエディター(既存ページ編集用)のツールチップ（リンク入力ダイアログなど）がサイドバーの後ろに隠れてしまう問題を解決する
    // 要素は動かさずに z-index だけ大きくする
    setTimeout(() => {
        const container = document.querySelector('#contentEditor.ql-container');
        if (!container) return;
        
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        
        // 非常に高い z-index を設定
        tooltip.style.setProperty('z-index', '100000', 'important');
    }, 100);
    
    // 初期コンテンツを設定
    if (initialContent) {
        contentQuill.root.innerHTML = initialContent;
    }
    
    // 既定のフォントサイズを 16px に設定
    contentQuill.format('size', '16px');
    
    // ツールバーのサイズピッカー表示を 16px に合わせる
    setTimeout(() => {
        const toolbar = contentQuill.getModule('toolbar');
        const container = toolbar.container;
        const sizePicker = container.querySelector('.ql-size');
        if (sizePicker) {
            const pickerLabel = sizePicker.querySelector('.ql-picker-label');
            if (pickerLabel) {
                // data-value 属性を設定（CSS の ::before で表示される）
                pickerLabel.setAttribute('data-value', '16px');
            }
        }
    }, 0);
    
    // テキスト入力時、サイズ未指定の範囲には 16px を適用
    contentQuill.on('text-change', function(delta, oldDelta, source) {
        if (source === 'user') {
            const selection = contentQuill.getSelection();
            if (selection) {
                const format = contentQuill.getFormat(selection.index);
                // サイズが未設定なら 16px を適用
                if (!format.size) {
                    contentQuill.formatText(selection.index, 0, 'size', '16px');
                }
            }
        }
    });
    
    // 画像リサイズ用のカスタムハンドラを追加
    addImageResizeHandlersFn(contentQuill);
    
    // 画像のドラッグ＆ドロップアップロードを追加
    addDragDropImageUploadFn(contentQuill, false);
    
    // 動画のドラッグ＆ドロップアップロードを追加
    addDragDropVideoUploadFn(contentQuill, false);
    
    // リンクのキーボードショートカット（Ctrl+K / Cmd+K）と自動リンク検出を追加
    addLinkShortcuts(contentQuill);
    
    return contentQuill;
}

// エクスポート: ハンドラ関数
export { videoHandler, imageHandler, addDragDropImageUpload, addDragDropVideoUpload, addImageResizeHandlers };
