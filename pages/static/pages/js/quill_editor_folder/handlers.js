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

