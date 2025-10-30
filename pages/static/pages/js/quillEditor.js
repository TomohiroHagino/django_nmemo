// pages/static/pages/js/quillEditor.js
import {
    registerVideoBlot,
    videoHandler,
    imageHandler,
    addImageResizeHandlers,
    addDragDropImageUpload,
    addDragDropVideoUpload,
    addDragDropExcelUpload,
    initCreateEditor,
    initContentEditor,
} from './features/quill-editor/index.js';

// 旧挙動維持のため（init.jsで登録済みなら削除可）
registerVideoBlot();

export {
    initCreateEditor,
    initContentEditor,
    videoHandler,
    imageHandler,
    addDragDropImageUpload,
    addDragDropVideoUpload,
    addDragDropExcelUpload,
    addImageResizeHandlers,
};