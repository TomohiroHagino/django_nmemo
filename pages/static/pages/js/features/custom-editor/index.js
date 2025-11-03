import { CustomEditor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { createImageHandler, createVideoHandler } from './media-handler.js';
import { setupDragDrop } from './drag-drop.js';
import { setupImageResize } from './image-resize.js';
// シンタックスハイライト機能は一旦コメントアウト
import { setupSyntaxHighlight } from './syntax-highlight.js';
import { setupShortcuts } from './shortcuts.js';
import { setupMarkdown } from './markdown.js';

export function initCreateEditor(imageHandlerFn, videoHandlerFn) {
  const editor = new CustomEditor('createEditor', {
      placeholder: 'コンテンツを入力してください...',
      isCreateModal: true  // 新規作成モーダルであることを明示
  });
  
  // ツールバーを追加
  const toolbar = new Toolbar(editor, 'createToolbar');
  
  // 画像・動画ハンドラー
  const imageHandler = createImageHandler(editor, null, true);
  const videoHandler = createVideoHandler(editor, null, true);
  
  editor.onImageClick = imageHandler;
  editor.onVideoClick = videoHandler;
  
  // ドラッグ&ドロップ
  setupDragDrop(editor, null, true);
  
  // 画像リサイズ
  setupImageResize(editor);
  
  // シンタックスハイライト（一旦コメントアウト）
  setupSyntaxHighlight(editor);
  
  // キーボードショートカット
  setupShortcuts(editor);
  
  // マークダウン記法
  setupMarkdown(editor);
  
  return editor;
}

export function initContentEditor(initialContent, imageHandlerFn, videoHandlerFn) {
    const editor = new CustomEditor('contentEditor', {
        placeholder: 'コンテンツを入力してください...'
    });
    
    if (initialContent) {
        editor.setContent(initialContent);
    }
    
    // ツールバーを追加
    const toolbar = new Toolbar(editor, 'contentToolbar');
    
    // 画像・動画ハンドラー
    let currentPageId = null;
    const imageHandler = createImageHandler(editor, currentPageId, false);
    const videoHandler = createVideoHandler(editor, currentPageId, false);
    
    editor.onImageClick = imageHandler;
    editor.onVideoClick = videoHandler;
    
    // ドラッグ&ドロップ
    setupDragDrop(editor, currentPageId, false);
    
    // 画像リサイズ
    setupImageResize(editor);
    
    // シンタックスハイライト（一旦コメントアウト）
    setupSyntaxHighlight(editor);
    
    // キーボードショートカット
    setupShortcuts(editor);

    // マークダウン記法
    setupMarkdown(editor);
    
    // currentPageIdを設定するメソッドを追加
    editor.setPageId = (pageId) => {
        currentPageId = pageId;
        editor.onImageClick = createImageHandler(editor, pageId, false);
        editor.onVideoClick = createImageHandler(editor, pageId, false);
        // ドラッグ&ドロップも更新
        setupDragDrop(editor, pageId, false);
    };
    
    return editor;
}
