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
        
        // 変更内容を確認
        const deltaOps = delta.ops;
        if (!deltaOps || deltaOps.length === 0) return;
        
        // 最後の操作が挿入で、スペースまたは改行が追加されたかを確認
        const lastOp = deltaOps[deltaOps.length - 1];
        if (lastOp && lastOp.insert && (lastOp.insert === ' ' || lastOp.insert === '\n')) {
            const selection = quill.getSelection();
            if (!selection) return;
            
            // スクロール位置を保存
            const scrollContainer = quill.root.parentElement;
            const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.pageYOffset || document.documentElement.scrollTop;
            
            const cursorPosition = selection.index;
            
            // スケールバーを使わずに、直接テキスト全体を取得して検索
            const allText = quill.getText(0);
            const textBeforeCursor = allText.substring(0, cursorPosition - 1);
            
            // URLパターンでマッチング
            const urlPattern = /(https?:\/\/[^\s\n]+)$/;
            const match = textBeforeCursor.match(urlPattern);
            
            if (match) {
                const url = match[0];
                
                // マッチしたURLがテキスト内のどこから始まるかを正確に計算
                const urlStartIndex = textBeforeCursor.length - url.length;
                
                // すでにリンク化されているかチェック
                const format = quill.getFormat(urlStartIndex, url.length);
                if (format.link) {
                    return;
                }
                
                // URLにリンクフォーマットを適用
                // 念のため、長さを1追加して確実に全体をカバー
                quill.formatText(urlStartIndex, url.length + 1, 'link', url);
                
                // カーソル位置とスクロール位置を復元
                const pageScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
                const contentBody = document.querySelector('.content-body');
                const savedScrollTop = contentBody ? contentBody.scrollTop : pageScrollY;
                
                setTimeout(() => {
                    const currentSelection = quill.getSelection();
                    if (currentSelection && currentSelection.index !== cursorPosition) {
                        // APIモードでsetSelection（スクロールを無効化）
                        quill.setSelection(cursorPosition, 'api');
                        
                        // setSelection後、スクロール位置を復元
                        requestAnimationFrame(() => {
                            if (contentBody) {
                                contentBody.scrollTop = savedScrollTop;
                            } else {
                                window.scrollTo({
                                    top: savedScrollTop,
                                    behavior: 'instant'
                                });
                                document.documentElement.scrollTop = savedScrollTop;
                            }
                        });
                    }
                }, 0);
            }
        }
    });
}
