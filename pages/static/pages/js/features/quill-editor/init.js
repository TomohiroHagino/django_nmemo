// pages/static/pages/js/features/quill-editor/init.js
import { registerVideoBlot } from './video-blot.js';
import { codeBlockNoHighlight } from './handler.js';
import { addImageResizeHandlers } from './image-resize.js';
import { addDragDropImageUpload, addDragDropVideoUpload, addDragDropExcelUpload } from './drag-drop.js';
import { addLinkShortcuts } from './shortcuts.js';
import { applySyntaxHighlight } from './syntax-highlight.js';

// VideoBlot をモジュール読み込み時に登録（従来のグローバル登録相当）
registerVideoBlot();

// ImageResize モジュールを一度だけ登録
if (window.ImageResize && !Quill.imports['modules/imageResize']) {
  Quill.register('modules/imageResize', window.ImageResize.default);
}

// 新規ページ作成用エディタ
export function initCreateEditor(
    imageHandlerFn,
    videoHandlerFn,
    addImageResizeHandlersFn = addImageResizeHandlers,
    addDragDropImageUploadFn = addDragDropImageUpload,
    addDragDropVideoUploadFn = addDragDropVideoUpload,
    addDragDropExcelUploadFn = addDragDropExcelUpload
) {
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
    Quill.register(Size, true);

    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        ['code', 'code-block'],
        ['code-block-no-highlight'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean'],
    ];

    const createQuill = new Quill('#createEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandlerFn,
                    video: videoHandlerFn,
                    'code-block-no-highlight': codeBlockNoHighlight,
                },
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize'],
            },
        },
        placeholder: 'コンテンツを入力してください...',
    });

    createQuill.format('size', '16px');

    setTimeout(() => {
        const toolbar = createQuill.getModule('toolbar');
        const container = toolbar.container;
        const sizePicker = container.querySelector('.ql-size');
        if (sizePicker) {
            const pickerLabel = sizePicker.querySelector('.ql-picker-label');
            if (pickerLabel) {
                pickerLabel.setAttribute('data-value', '16px');
            }
        }
    }, 0);

    createQuill.on('text-change', function (delta, oldDelta, source) {
        if (source === 'user') {
            const selection = createQuill.getSelection();
            if (selection) {
                const format = createQuill.getFormat(selection.index);
                if (!format.size) {
                    createQuill.formatText(selection.index, 0, 'size', '16px');
                }
            }
        }
    });

    setTimeout(() => {
        const container = document.querySelector('#createEditor.ql-container');
        if (!container) return;
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        tooltip.style.setProperty('z-index', '100000', 'important');
    }, 100);

    addImageResizeHandlersFn(createQuill);
    addDragDropImageUploadFn(createQuill, true);
    addDragDropVideoUploadFn(createQuill, true);
    addDragDropExcelUploadFn(createQuill, true);

    addLinkShortcuts(createQuill);
    applySyntaxHighlight(createQuill);

    return createQuill;
}

// 既存ページ編集用エディタ
export function initContentEditor(
    initialContent,
    imageHandlerFn,
    videoHandlerFn,
    addImageResizeHandlersFn = addImageResizeHandlers,
    addDragDropImageUploadFn = addDragDropImageUpload,
    addDragDropVideoUploadFn = addDragDropVideoUpload,
    addDragDropExcelUploadFn = addDragDropExcelUpload
) {
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'];
    Quill.register(Size, true);

    const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': Size.whitelist }],
        ['bold', 'italic', 'underline', 'strike'],
        ['code', 'code-block'],
        ['code-block-no-highlight'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean'],
    ];

    const contentQuill = new Quill('#contentEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandlerFn,
                    video: videoHandlerFn,
                    'code-block-no-highlight': codeBlockNoHighlight,
                },
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize'],
            },
        },
        placeholder: 'コンテンツを入力してください...',
    });

    // 貼り付け時にページ全体のスクロール位置を保持（QuillのsetSelectionをオーバーライド）
    const editorElement = contentQuill.root;
    const contentBody = document.querySelector('.content-body');
    let isPasting = false;
    let savedScrollTop = 0;
    let pasteTimer = null;
    
    // 元のsetSelectionメソッドを保存
    const originalSetSelection = contentQuill.setSelection.bind(contentQuill);
    
    // setSelectionをオーバーライドして、貼り付け中はスクロールを無効化
    contentQuill.setSelection = function(range, source) {
        if (isPasting && source !== 'api') {
            // 貼り付け中は'api'モードで呼び出す（スクロールを無効化）
            return originalSetSelection(range, 'api');
        }
        return originalSetSelection(range, source);
    };
    
    // スクロール位置を保存する関数
    const saveScrollPosition = () => {
        if (contentBody) {
            savedScrollTop = contentBody.scrollTop;
        } else {
            savedScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        }
    };
    
    // スクロール位置を復元する関数
    const restoreScrollPosition = () => {
        if (contentBody) {
            contentBody.scrollTop = savedScrollTop;
        } else {
            window.scrollTo({
                top: savedScrollTop,
                behavior: 'instant'
            });
            document.documentElement.scrollTop = savedScrollTop;
        }
    };
    
    editorElement.addEventListener('paste', (e) => {
        // 貼り付け開始
        isPasting = true;
        saveScrollPosition();
        
        // 既存のタイマーをクリア
        if (pasteTimer) {
            clearTimeout(pasteTimer);
        }
        
        // 貼り付け処理中、定期的にスクロール位置を復元
        const restoreInterval = setInterval(() => {
            if (isPasting) {
                restoreScrollPosition();
            } else {
                clearInterval(restoreInterval);
            }
        }, 16); // 約60fps
        
        // 1秒後（貼り付け処理が完了する想定）にフラグを解除
        pasteTimer = setTimeout(() => {
            isPasting = false;
            clearInterval(restoreInterval);
            // 最後に一度スクロール位置を復元
            restoreScrollPosition();
        }, 1000);
    }, true);
    
    // text-changeイベントでもスクロール位置をチェック
    contentQuill.on('text-change', function (delta, oldDelta, source) {
        if (source === 'user' && isPasting) {
            // 貼り付け中の場合はスクロール位置を強制的に復元
            restoreScrollPosition();
        }
        
        if (source === 'user') {
            const selection = contentQuill.getSelection();
            if (selection) {
                const format = contentQuill.getFormat(selection.index);
                if (!format.size) {
                    contentQuill.formatText(selection.index, 0, 'size', '16px');
                }
            }
        }
    });
    
    // selection-changeイベントでもスクロール位置をチェック
    contentQuill.on('selection-change', (range) => {
        if (isPasting && range) {
            restoreScrollPosition();
        }
    });

    setTimeout(() => {
        const container = document.querySelector('#contentEditor.ql-container');
        if (!container) return;
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        tooltip.style.setProperty('z-index', '100000', 'important');
    }, 100);

    if (initialContent) {
        contentQuill.root.innerHTML = initialContent;
    }

    contentQuill.format('size', '16px');

    setTimeout(() => {
        const toolbar = contentQuill.getModule('toolbar');
        const container = toolbar.container;
        const sizePicker = container.querySelector('.ql-size');
        if (sizePicker) {
            const pickerLabel = sizePicker.querySelector('.ql-picker-label');
            if (pickerLabel) {
                pickerLabel.setAttribute('data-value', '16px');
            }
        }
    }, 0);

    addImageResizeHandlersFn(contentQuill);
    addDragDropImageUploadFn(contentQuill, false);
    addDragDropVideoUploadFn(contentQuill, false);
    if (addDragDropExcelUploadFn) {
        addDragDropExcelUploadFn(contentQuill, false);
    }

    addLinkShortcuts(contentQuill);
    applySyntaxHighlight(contentQuill);

    return contentQuill;
}