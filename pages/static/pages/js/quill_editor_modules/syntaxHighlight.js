// シンタックスハイライト機能

export function applySyntaxHighlight(quill) {
  console.log('Initializing syntax highlight...');
  console.log('hljs available?', typeof hljs);
  
  const highlightCodeBlocks = () => {
      console.log('=== Highlight function called ===');
      
      // Quillのコードブロック: pre.ql-syntax
      const codeBlocks = quill.root.querySelectorAll('pre.ql-syntax');
      
      console.log('Found code blocks:', codeBlocks.length);
      
      codeBlocks.forEach((pre, index) => {
          console.log(`Processing code block ${index}:`, pre);
          
          // すでにcode要素がある場合はスキップ
          if (pre.querySelector('code.hljs')) {
              console.log(`Block ${index} already highlighted`);
              return;
          }
          
          if (pre.textContent && pre.textContent.trim()) {
              console.log(`Code block ${index} content:`, pre.textContent.substring(0, 50));
              
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
                  
                  console.log(`Calling hljs.highlightElement for block ${index}`);
                  hljs.highlightElement(code);
                  console.log(`Block ${index} highlighted successfully`);
              } catch (error) {
                  console.error(`Failed to highlight block ${index}:`, error);
              }
          }
      });
  };
  
  // テキスト変更時にハイライトを適用（遅延を長くしてショートカットの妨害を回避）
  quill.on('text-change', (delta, oldDelta, source) => {
      console.log('Text changed:', source);
      if (source === 'user') {
          // 長めの遅延でショートカット処理を妨害しないようにする
          setTimeout(highlightCodeBlocks, 500);
      }
  });
  
  // 初期ロード時
  console.log('Setting up initial highlight timeouts...');
  setTimeout(() => {
      console.log('Timeout 1: 300ms');
      highlightCodeBlocks();
  }, 300);
  
  setTimeout(() => {
      console.log('Timeout 2: 800ms');
      highlightCodeBlocks();
  }, 800);
  
  setTimeout(() => {
      console.log('Timeout 3: 1500ms');
      highlightCodeBlocks();
  }, 1500);
}
