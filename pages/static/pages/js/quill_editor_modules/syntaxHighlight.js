// シンタックスハイライト機能

export function applySyntaxHighlight(quill) {

    const highlightCodeBlocks = () => {
        console.debug('=== Highlight function called ===');
        
        // Quillのコードブロック: pre.ql-syntax
        const codeBlocks = quill.root.querySelectorAll('pre.ql-syntax');
        
        console.debug('Found code blocks:', codeBlocks.length);
        
        codeBlocks.forEach((pre, index) => {
            console.debug(`Processing code block ${index}:`, pre);
            
            // すでにcode要素がある場合はスキップ
            if (pre.querySelector('code.hljs')) {
                console.debug(`Block ${index} already highlighted`);
                return;
            }
            
            if (pre.textContent && pre.textContent.trim()) {
                console.debug(`Code block ${index} content:`, pre.textContent.substring(0, 50));
                
                try {
                    if (typeof hljs === 'undefined') {
                        console.error('hljs is not defined!');
                        return;
                    }
                    
                    // テキストを取得
                    const text = pre.textContent;
                    
                    // 既存のcode要素をチェック
                    let code = pre.querySelector('code');
                    if (!code) {
                        // code要素がない場合は作成
                        code = document.createElement('code');
                        pre.appendChild(code);
                    }
                    
                    code.textContent = text;
                    
                    console.debug(`Calling hljs.highlightElement for block ${index}`);
                    hljs.highlightElement(code);
                    console.debug(`Block ${index} highlighted successfully`);
                } catch (error) {
                    console.error(`Failed to highlight block ${index}:`, error);
                }
            }
        });
    };
    
    // テキスト変更時にハイライトを適用（遅延を長くしてショートカットの妨害を回避）
    quill.on('text-change', (delta, oldDelta, source) => {
        console.debug('Text changed:', source);
        if (source === 'user') {
            // 長めの遅延でショートカット処理を妨害しないようにする
            setTimeout(highlightCodeBlocks, 500);
        }
    });
    
    // 初期ロード時
    console.debug('Setting up initial highlight timeouts...');
    setTimeout(() => {
        console.debug('Timeout 1: 300ms');
        highlightCodeBlocks();
    }, 300);
    
    setTimeout(() => {
        console.debug('Timeout 2: 800ms');
        highlightCodeBlocks();
    }, 800);
    
    setTimeout(() => {
        console.debug('Timeout 3: 1500ms');
        highlightCodeBlocks();
    }, 1500);
  }
  