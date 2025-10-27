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

