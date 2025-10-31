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

    contentQuill.on('text-change', function (delta, oldDelta, source) {
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