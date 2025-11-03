// シンタックスハイライト機能

export function applySyntaxHighlight(quill) {
    const highlightCodeBlocks = () => {
        // Quillのコードブロック: pre.ql-syntax
        const codeBlocks = quill.root.querySelectorAll('pre.ql-syntax');
        
        codeBlocks.forEach((pre, index) => {
            // すでにハイライト済み（code.hljs要素が存在）の場合はスキップ
            if (pre.querySelector('code.hljs')) {
                return;
            }
            
            // テキストコンテンツを取得（子要素がなくなるように）
            const textContent = pre.textContent || pre.innerText;
            
            // テキストが存在しない場合はスキップ
            if (!textContent || !textContent.trim()) {
                return;
            }
            
            // no-highlightコメントが含まれている場合はスキップ
            if (textContent.trim().startsWith('<!-- no-highlight -->') || 
                textContent.trim().startsWith('// no-highlight') ||
                textContent.trim().startsWith('/* no-highlight */')) {
                return;
            }
            
            try {
                if (typeof hljs === 'undefined') {
                    console.error('hljs is not defined!');
                    return;
                }
                
                // カーソル位置とスクロール位置を保存
                const selection = quill.getSelection();
                const scrollContainer = quill.root.parentElement;
                const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.pageYOffset || document.documentElement.scrollTop;
                
                // すべての既存の子要素（code要素など）を削除
                pre.innerHTML = '';
                
                // 新しいcode要素を作成
                const code = document.createElement('code');
                code.textContent = textContent;
                pre.appendChild(code);
                
                hljs.highlightElement(code);
                
                // カーソル位置とスクロール位置を復元
                if (selection) {
                    setTimeout(() => {
                        // スクロール位置を復元
                        if (scrollContainer) {
                            scrollContainer.scrollTop = scrollTop;
                        } else {
                            window.scrollTo(0, scrollTop);
                        }
                        quill.setSelection(selection, 'api');
                        // setSelection後に再度スクロール位置を復元
                        requestAnimationFrame(() => {
                            if (scrollContainer) {
                                scrollContainer.scrollTop = scrollTop;
                            } else {
                                window.scrollTo(0, scrollTop);
                            }
                        });
                    }, 0);
                }
            } catch (error) {
                console.error(`Failed to highlight block ${index}:`, error);
            }
        });
    };
    
    // テキスト変更時にハイライトを適用（遅延を長くしてショートカットの妨害を回避）
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user') {
            // 長めの遅延でショートカット処理を妨害しないようにする
            setTimeout(highlightCodeBlocks, 500);
        }
    });
    
    // 初期ロード時
    setTimeout(() => {
        highlightCodeBlocks();
    }, 300);
}