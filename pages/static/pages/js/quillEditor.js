// Quill editor initialization and image handling

// カスタムVideoBlotを登録（ローカル動画ファイル用の<video>タグ）
const BlockEmbed = Quill.import('blots/block/embed');

class VideoBlot extends BlockEmbed {
    // 動画要素（iframe または video タグ）を作成
    static create(value) {
        const node = super.create();
        // URLがYouTube/Vimeoの場合はiframe、それ以外は<video>タグ
        if (value.includes('youtube.com') || value.includes('youtu.be') || value.includes('vimeo.com')) {
            // iframe用
            const iframe = document.createElement('iframe');
            iframe.setAttribute('src', value);
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', true);
            iframe.setAttribute('class', 'ql-video');
            node.appendChild(iframe);
        } else {
            // ローカル動画用の<video>タグ
            const video = document.createElement('video');
            video.setAttribute('controls', '');
            video.setAttribute('class', 'ql-video-local');
            video.style.maxWidth = '100%';
            video.style.height = 'auto';
            
            const source = document.createElement('source');
            source.setAttribute('src', value);
            video.appendChild(source);
            
            node.appendChild(video);
        }
        return node;
    }
    
    // 動画要素からURLを取得
    static value(node) {
        const iframe = node.querySelector('iframe');
        const video = node.querySelector('video source');
        return iframe ? iframe.getAttribute('src') : (video ? video.getAttribute('src') : '');
    }
}

VideoBlot.blotName = 'video';
VideoBlot.tagName = 'div';
VideoBlot.className = 'video-wrapper';

Quill.register(VideoBlot);

// 新規ページ作成用のQuillエディタを初期化
export function initCreateEditor(imageHandler, videoHandler, addImageResizeHandlers, addDragDropImageUpload, addDragDropVideoUpload) {
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
    
    // Register Image Resize Module if available
    if (window.ImageResize) {
        Quill.register('modules/imageResize', window.ImageResize.default);
    }
    
    const createQuill = new Quill('#createEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandler,
                    video: videoHandler
                }
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize']
            }
        },
        placeholder: 'コンテンツを入力してください...'
    });
    
    // デフォルトのフォントサイズを16pxに設定
    createQuill.format('size', '16px');
    
    // ツールバーのフォントサイズピッカーを16pxに設定
    setTimeout(() => {
        const toolbar = createQuill.getModule('toolbar');
        const container = toolbar.container;
        const sizePicker = container.querySelector('.ql-size');
        if (sizePicker) {
            const pickerLabel = sizePicker.querySelector('.ql-picker-label');
            if (pickerLabel) {
                // data-value属性を設定するだけ（CSSの::beforeが自動で表示）
                pickerLabel.setAttribute('data-value', '16px');
            }
        }
    }, 0);
    
    // テキスト入力時にデフォルトフォントサイズを適用
    createQuill.on('text-change', function(delta, oldDelta, source) {
        if (source === 'user') {
            const selection = createQuill.getSelection();
            if (selection) {
                const format = createQuill.getFormat(selection.index);
                // サイズが設定されていない場合、16pxを適用
                if (!format.size) {
                    createQuill.formatText(selection.index, 0, 'size', '16px');
                }
            }
        }
    });
    
    // SIMPLE FIX: Just boost z-index, don't move anything
    setTimeout(() => {
        const container = document.querySelector('#createEditor.ql-container');
        if (!container) return;
        
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        
        // Set very high z-index
        tooltip.style.setProperty('z-index', '999999999', 'important');
    }, 100);
    
    // Add custom image resize functionality
    addImageResizeHandlers(createQuill);
    
    // Add drag and drop image upload
    addDragDropImageUpload(createQuill, true);
    
    // Add drag and drop video upload
    addDragDropVideoUpload(createQuill, true);
    
    // Add link keyboard shortcut (Ctrl+K / Cmd+K) and auto-link detection
    addLinkShortcuts(createQuill);
    
    return createQuill;
}

// 既存ページのコンテンツ表示・編集用のQuillエディタを初期化
export function initContentEditor(initialContent, imageHandler, videoHandler, addImageResizeHandlers, addDragDropImageUpload, addDragDropVideoUpload) {
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
    
    // Register Image Resize Module if available
    if (window.ImageResize) {
        Quill.register('modules/imageResize', window.ImageResize.default);
    }
    
    const contentQuill = new Quill('#contentEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    image: imageHandler,
                    video: videoHandler
                }
            },
            imageResize: {
                displaySize: true,
                modules: ['Resize', 'DisplaySize']
            }
        },
        placeholder: 'コンテンツを入力してください...'
    });
    
    // SIMPLE FIX: Just boost z-index, don't move anything
    setTimeout(() => {
        const container = document.querySelector('#contentEditor.ql-container');
        if (!container) return;
        
        const tooltip = container.querySelector('.ql-tooltip');
        if (!tooltip) return;
        
        // Set very high z-index
        tooltip.style.setProperty('z-index', '999999999', 'important');
    }, 100);
    
    // Set initial content
    if (initialContent) {
        contentQuill.root.innerHTML = initialContent;
    }
    
    // デフォルトのフォントサイズを16pxに設定
    contentQuill.format('size', '16px');
    
    // ツールバーのフォントサイズピッカーを16pxに設定
    setTimeout(() => {
        const toolbar = contentQuill.getModule('toolbar');
        const container = toolbar.container;
        const sizePicker = container.querySelector('.ql-size');
        if (sizePicker) {
            const pickerLabel = sizePicker.querySelector('.ql-picker-label');
            if (pickerLabel) {
                // data-value属性を設定するだけ（CSSの::beforeが自動で表示）
                pickerLabel.setAttribute('data-value', '16px');
            }
        }
    }, 0);
    
    // テキスト入力時にデフォルトフォントサイズを適用
    contentQuill.on('text-change', function(delta, oldDelta, source) {
        if (source === 'user') {
            const selection = contentQuill.getSelection();
            if (selection) {
                const format = contentQuill.getFormat(selection.index);
                // サイズが設定されていない場合、16pxを適用
                if (!format.size) {
                    contentQuill.formatText(selection.index, 0, 'size', '16px');
                }
            }
        }
    });
    
    // Add custom image resize functionality
    addImageResizeHandlers(contentQuill);
    
    // Add drag and drop image upload
    addDragDropImageUpload(contentQuill, false);
    
    // Add drag and drop video upload
    addDragDropVideoUpload(contentQuill, false);
    
    // Add link keyboard shortcut (Ctrl+K / Cmd+K) and auto-link detection
    addLinkShortcuts(contentQuill);
    
    return contentQuill;
}

// YouTube/Vimeo URL または ローカル動画ファイルを挿入するハンドラ
export function videoHandler(currentPageId, getCreateQuill) {
    const self = this;
    const createQuill = getCreateQuill();
    
    // ユーザーに選択肢を提示
    const choice = prompt('1: YouTube/Vimeo URLを入力\n2: 動画ファイルをアップロード\n\n番号を入力してください (1 または 2):');
    
    if (choice === '1') {
        // YouTube/Vimeo URLを入力
        const url = prompt('YouTube または Vimeo の URL を入力してください:');
        if (!url) return;
        
        // サイズを選択
        const size = prompt('動画のサイズを選択してください:\n1: 小 (420x236)\n2: 中 (560x315) - デフォルト\n3: 大 (840x472)\n\n番号を入力してください (1, 2, または 3):');
        
        let width, height;
        if (size === '1') {
            width = 420;
            height = 236;
        } else if (size === '3') {
            width = 840;
            height = 472;
        } else {
            // デフォルトは中サイズ
            width = 560;
            height = 315;
        }
        
        // YouTube/Vimeo URLを埋め込み用に変換
        let embedUrl = url;
        
        // YouTube URL の処理
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        
        // Vimeo URL の処理
        const vimeoRegex = /vimeo\.com\/(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        
        // エディタに埋め込み（サイズ指定付き）
        const quill = self.quill;
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'video', embedUrl);
        
        // 挿入後にiframeのサイズを設定
        setTimeout(() => {
            const editor = quill.root;
            const iframes = editor.querySelectorAll('iframe');
            const lastIframe = iframes[iframes.length - 1];
            if (lastIframe && lastIframe.src === embedUrl) {
                lastIframe.style.width = width + 'px';
                lastIframe.style.height = height + 'px';
            }
        }, 100);
        
        quill.setSelection(range.index + 1);
        
    } else if (choice === '2') {
        // ファイルアップロード
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'video/mp4,video/webm,video/ogg,video/quicktime');
        
        input.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const file = input.files[0];
            if (!file) return;
            
            // Validate file size (250MB max for videos)
            if (file.size > 250 * 1024 * 1024) {
                alert('動画ファイルサイズは250MB以下にしてください');
                return;
            }
            
            // Determine which editor is being used
            const isCreateModal = (self.quill === createQuill);
            let pageId;
            
            if (isCreateModal) {
                // Creating new page - use temp folder
                pageId = 'temp';
            } else {
                // Editing existing page - must have currentPageId
                if (!currentPageId) {
                    alert('ページIDが取得できません。ページを再読み込みしてください。');
                    return;
                }
                pageId = currentPageId;
            }
            
            // Upload video
            const formData = new FormData();
            formData.append('video', file);
            formData.append('page_id', pageId);
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/api/upload-video/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Insert video into editor
                    const quill = self.quill;
                    const range = quill.getSelection(true);
                    quill.insertEmbed(range.index, 'video', data.url);
                    quill.setSelection(range.index + 1);
                } else {
                    alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('動画のアップロードに失敗しました');
            }
        });
        
        input.click();
    }
}

// 画像ファイルを選択してアップロード・挿入するハンドラ
export function imageHandler(currentPageId, getCreateQuill) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    
    const self = this; // Save context to determine which editor is being used
    const createQuill = getCreateQuill();
    
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('ファイルサイズは5MB以下にしてください');
            return;
        }
        
        // Determine which editor is being used
        const isCreateModal = (self.quill === createQuill);
        let pageId;
        
        if (isCreateModal) {
            // Creating new page - use temp folder
            pageId = 'temp';
        } else {
            // Editing existing page - must have currentPageId
            if (!currentPageId) {
                alert('ページIDが取得できません。ページを再読み込みしてください。');
                return;
            }
            pageId = currentPageId;
        }
        
        // Upload image
        const formData = new FormData();
        formData.append('image', file);
        formData.append('page_id', pageId);
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        try {
            const response = await fetch('/api/upload-image/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Insert image into editor
                const quill = self.quill;
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', data.url);
                quill.setSelection(range.index + 1);
            } else {
                alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
            }
        } catch (error) {
            alert('画像のアップロードに失敗しました');
        }
    };
}

// エディタに画像のドラッグ&ドロップアップロード機能を追加
export function addDragDropImageUpload(quill, isCreateModal, currentPageId) {
    const editor = quill.root;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
    });
    
    // ドラッグイベントのデフォルト動作を防止
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        editor.addEventListener(eventName, () => {
            editor.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, () => {
            editor.classList.remove('drag-over');
        }, false);
    });
    
    // Handle dropped files
    editor.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length === 0) return;
        
        // ドロップした位置を取得
        const range = quill.getSelection(true);
        let insertIndex = range ? range.index : quill.getLength();
        
        // マウス位置から正確な挿入位置を計算
        const editorBounds = editor.getBoundingClientRect();
        const dropY = e.clientY - editorBounds.top;
        const dropX = e.clientX - editorBounds.left;
        
        // Quillの内部APIを使用して正確な位置を取得
        try {
            const blot = quill.scroll.find(e.target);
            if (blot) {
                const offset = blot.offset(quill.scroll);
                insertIndex = offset;
            }
        } catch (err) {
            // フォールバック: 現在の選択位置を使用
            insertIndex = range ? range.index : quill.getLength();
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                continue; // Skip non-image files
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert(`ファイル "${file.name}" のサイズは5MB以下にしてください`);
                continue;
            }
            
            // Determine page ID
            let pageId;
            if (isCreateModal) {
                pageId = 'temp';
            } else {
                if (!currentPageId) {
                    alert('ページIDが取得できません。ページを再読み込みしてください。');
                    return;
                }
                pageId = currentPageId;
            }
            
            // Upload image
            const formData = new FormData();
            formData.append('image', file);
            formData.append('page_id', pageId);
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/api/upload-image/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // ドロップした位置に画像を挿入
                    quill.insertEmbed(insertIndex, 'image', data.url);
                    quill.insertText(insertIndex + 1, '\n'); // 画像の後に改行を追加
                    // 次の画像用にインデックスを更新
                    insertIndex += 2; // 画像 + 改行
                } else {
                    alert('画像のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('画像のアップロードに失敗しました');
            }
        }
    }, false);
}

// エディタに動画のドラッグ&ドロップアップロード機能を追加
export function addDragDropVideoUpload(quill, isCreateModal, currentPageId) {
    const editor = quill.root;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, preventDefaults, false);
    });
    
    // ドラッグイベントのデフォルト動作を防止
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        editor.addEventListener(eventName, () => {
            editor.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        editor.addEventListener(eventName, () => {
            editor.classList.remove('drag-over');
        }, false);
    });
    
    // Handle dropped files
    editor.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length === 0) return;
        
        // ドロップした位置を取得
        const range = quill.getSelection(true);
        let insertIndex = range ? range.index : quill.getLength();
        
        // マウス位置から正確な挿入位置を計算
        const editorBounds = editor.getBoundingClientRect();
        const dropY = e.clientY - editorBounds.top;
        const dropX = e.clientX - editorBounds.left;
        
        // Quillの内部APIを使用して正確な位置を取得
        try {
            const blot = quill.scroll.find(e.target);
            if (blot) {
                const offset = blot.offset(quill.scroll);
                insertIndex = offset;
            }
        } catch (err) {
            // フォールバック: 現在の選択位置を使用
            insertIndex = range ? range.index : quill.getLength();
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if file is a video
            if (!file.type.startsWith('video/')) {
                continue; // Skip non-video files
            }
            
            // Validate file size (250MB max)
            if (file.size > 250 * 1024 * 1024) {
                alert(`ファイル "${file.name}" のサイズは250MB以下にしてください`);
                continue;
            }
            
            // Determine page ID
            let pageId;
            if (isCreateModal) {
                pageId = 'temp';
            } else {
                if (!currentPageId) {
                    alert('ページIDが取得できません。ページを再読み込みしてください。');
                    return;
                }
                pageId = currentPageId;
            }
            
            // Upload video
            const formData = new FormData();
            formData.append('video', file);
            formData.append('page_id', pageId);
            
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/api/upload-video/', {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // ドロップした位置に動画を挿入
                    quill.insertEmbed(insertIndex, 'video', data.url);
                    quill.insertText(insertIndex + 1, '\n'); // 動画の後に改行を追加
                    // 次の動画用にインデックスを更新
                    insertIndex += 2; // 動画 + 改行
                } else {
                    alert('動画のアップロードに失敗しました: ' + (data.error || '不明なエラー'));
                }
            } catch (error) {
                alert('動画のアップロードに失敗しました');
            }
        }
    }, false);
}

// エディタに画像のリサイズ機能を追加（8方向のハンドルで拡大縮小）
export function addImageResizeHandlers(quill) {
    const editor = quill.root;
    let selectedElement = null; // Changed from selectedImage to support both img and iframe
    let resizeHandles = null;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let aspectRatio = 1;
    // Click on image to select (iframeはリサイズ不可とする)
    editor.addEventListener('click', (e) => {
        const target = e.target;
        
        // 画像をクリック
        if (target.tagName === 'IMG') {
            e.stopPropagation();
            selectElement(target);
            return;
        }
        
        // リサイズハンドル以外をクリック
        if (!target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    // 画像を選択状態にしてリサイズハンドルを表示
    function selectElement(element) {
        deselectElement();
        selectedElement = element;
        element.classList.add('selected');
        
        // Create resize handles (画像のみ)
        if (element.tagName === 'IMG') {
            createResizeHandles(element);
        }
    }
    
    // 画像の周囲に8方向のリサイズハンドルを作成
    function createResizeHandles(element) {
        const rect = element.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        
        // ハンドル用のコンテナを作成する
        const container = document.createElement('div');
        container.className = 'image-resize-container';
        container.style.position = 'absolute';
        container.style.left = (rect.left - editorRect.left + editor.scrollLeft) + 'px';
        container.style.top = (rect.top - editorRect.top + editor.scrollTop) + 'px';
        container.style.width = rect.width + 'px';
        container.style.height = rect.height + 'px';
        container.style.pointerEvents = 'none';
        
        // 8つのハンドルを作成する
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.style.pointerEvents = 'all';
            handle.dataset.position = pos;
            
            handle.addEventListener('mousedown', startResize);
            container.appendChild(handle);
        });
        
        editor.style.position = 'relative';
        editor.appendChild(container);
        resizeHandles = container;
    }
    
    // リサイズ操作を開始（初期位置とサイズを記録）
    function startResize(e) {
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        resizeHandle = e.target.dataset.position;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = selectedElement.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = startWidth / startHeight;
        
        selectedElement.classList.add('resizing');
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }
    
    // マウス移動に応じて画像のサイズを変更（アスペクト比を維持）
    function doResize(e) {
        if (!isResizing || !selectedElement) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        // Calculate new dimensions based on handle position
        switch(resizeHandle) {
            case 'se':
            case 'e':
                newWidth = startWidth + deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 'sw':
            case 'w':
                newWidth = startWidth - deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 'ne':
                newWidth = startWidth + deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 'nw':
                newWidth = startWidth - deltaX;
                newHeight = newWidth / aspectRatio;
                break;
            case 's':
                newHeight = startHeight + deltaY;
                newWidth = newHeight * aspectRatio;
                break;
            case 'n':
                newHeight = startHeight - deltaY;
                newWidth = newHeight * aspectRatio;
                break;
        }
        
        // Apply constraints
        newWidth = Math.max(50, Math.min(newWidth, editor.clientWidth - 20));
        newHeight = newWidth / aspectRatio;
        
        selectedElement.style.width = newWidth + 'px';
        selectedElement.style.height = newHeight + 'px';
        
        // Update handles position
        updateHandlesPosition();
    }
    
    // リサイズ操作を終了してイベントリスナーを削除
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            resizeHandle = null;
            selectedElement.classList.remove('resizing');
            
            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
        }
    }
    
    // リサイズハンドルの位置を画像の新しいサイズに合わせて更新
    function updateHandlesPosition() {
        if (!selectedElement || !resizeHandles) return;
        
        const rect = selectedElement.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        
        resizeHandles.style.left = (rect.left - editorRect.left + editor.scrollLeft) + 'px';
        resizeHandles.style.top = (rect.top - editorRect.top + editor.scrollTop) + 'px';
        resizeHandles.style.width = rect.width + 'px';
        resizeHandles.style.height = rect.height + 'px';
    }
    
    // 画像の選択を解除してリサイズハンドルを削除
    function deselectElement() {
        if (selectedElement) {
            selectedElement.classList.remove('selected', 'resizing');
            selectedElement = null;
        }
        if (resizeHandles) {
            resizeHandles.remove();
            resizeHandles = null;
        }
    }
    
    // 外側をクリックした時に選択を解除する
    document.addEventListener('click', (e) => {
        if (!editor.contains(e.target) && !e.target.classList.contains('resize-handle')) {
            deselectElement();
        }
    });
    
    // 選択した要素（画像またはiframe）をDelete/Backspaceキーで削除
    document.addEventListener('keydown', (e) => {
        if (selectedElement && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (document.activeElement === editor || editor.contains(document.activeElement)) {
                e.preventDefault();
                selectedElement.remove();
                deselectElement();
            }
        }
    });
    
    // スクロール時にハンドルを更新する
    editor.addEventListener('scroll', () => {
        if (selectedElement) {
            updateHandlesPosition();
        }
    });
}

// リンクのキーボードショートカット（Ctrl+K / Cmd+K）と自動リンク検出、色のショートカットを追加
export function addLinkShortcuts(quill) {
    const editor = quill.root;
    
    // キーボードショートカット
    editor.addEventListener('keydown', (e) => {
        // Ctrl+K / Cmd+K でリンクダイアログを開く
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'k') {
            e.preventDefault();
            
            const range = quill.getSelection();
            if (range) {
                // テキストが選択されている場合
                if (range.length > 0) {
                    const text = quill.getText(range.index, range.length);
                    const url = prompt('リンクのURLを入力してください:', 'https://');
                    
                    if (url && url !== 'https://') {
                        // 選択されたテキストにリンクを適用
                        quill.formatText(range.index, range.length, 'link', url);
                    }
                } else {
                    // テキストが選択されていない場合
                    const url = prompt('リンクのURLを入力してください:', 'https://');
                    
                    if (url && url !== 'https://') {
                        // URLをテキストとして挿入してリンク化
                        quill.insertText(range.index, url, 'link', url);
                        quill.setSelection(range.index + url.length);
                    }
                }
            }
        }
        
        // Ctrl+Shift+; / Cmd+Shift+; で文字を赤色に（確実にバッティングしないショートカット）
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === ';' || e.key === ':' || e.code === 'Semicolon')) {
            e.preventDefault();
            
            const range = quill.getSelection();
            if (range && range.length > 0) {
                // テキストが選択されている場合のみ色を適用
                const currentFormat = quill.getFormat(range);
                
                // 現在赤色の場合は解除、そうでなければ赤色を適用
                if (currentFormat.color === '#ff0000' || currentFormat.color === 'red' || currentFormat.color === 'rgb(255, 0, 0)') {
                    quill.formatText(range.index, range.length, 'color', false);
                } else {
                    quill.formatText(range.index, range.length, 'color', '#ff0000');
                }
            }
        }
        
        // Ctrl+Shift+' / Cmd+Shift+' で文字を青色に
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '\'' || e.key === '"' || e.code === 'Quote')) {
            e.preventDefault();
            
            const range = quill.getSelection();
            if (range && range.length > 0) {
                // テキストが選択されている場合のみ色を適用
                const currentFormat = quill.getFormat(range);
                
                // 現在青色の場合は解除、そうでなければ青色を適用
                if (currentFormat.color === '#0000ff' || currentFormat.color === 'blue' || currentFormat.color === 'rgb(0, 0, 255)') {
                    quill.formatText(range.index, range.length, 'color', false);
                } else {
                    quill.formatText(range.index, range.length, 'color', '#0000ff');
                }
            }
        }
    });
    
    // URLを入力したら自動的にリンクに変換
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source !== 'user') return;
        
        const selection = quill.getSelection();
        if (!selection) return;
        
        // カーソル位置の前の単語を取得
        const cursorPosition = selection.index;
        const text = quill.getText(0, cursorPosition);
        
        // URLパターンにマッチするか確認（スペースまたは改行で区切られたURL）
        const urlPattern = /(?:^|[\s\n])(https?:\/\/[^\s\n]+)$/;
        const match = text.match(urlPattern);
        
        if (match) {
            const url = match[1];
            const urlStartIndex = cursorPosition - url.length;
            
            // 現在の文字がスペースまたは改行の場合のみ自動リンク化
            const currentChar = quill.getText(cursorPosition - 1, 1);
            if (currentChar === ' ' || currentChar === '\n') {
                // URLの前にスペースがある場合は除外
                const beforeUrl = quill.getText(urlStartIndex - 1, 1);
                const actualStartIndex = (beforeUrl === ' ' || beforeUrl === '\n') ? urlStartIndex : urlStartIndex;
                
                // URLにリンクフォーマットを適用
                quill.formatText(actualStartIndex, url.length, 'link', url);
            }
        }
    });
}

