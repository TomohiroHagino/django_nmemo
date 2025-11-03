// マークダウン記法の処理
export function setupMarkdown(editor) {
  const editorEl = editor.editor;
  let isProcessing = false;
  
  // beforeinputイベントで入力前に処理
  editorEl.addEventListener('beforeinput', (e) => {
      if (isProcessing) return;
      
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const blockElement = getBlockElement(range);
      if (!blockElement) return;
      
      // コードブロック内は処理しない
      if (blockElement.tagName === 'PRE' || blockElement.closest('pre')) {
          return;
      }
      
      const text = blockElement.textContent || '';
      
      // Enterキーが押された場合
      if (e.inputType === 'insertLineBreak') {
          // 見出しの処理
          if (text.match(/^#{1,6}\s+.*/)) {
              e.preventDefault();
              isProcessing = true;
              setTimeout(() => {
                  convertHeading(blockElement, text);
                  isProcessing = false;
              }, 0);
              return;
          }
          
          // リストの処理
          if (text.match(/^[-*+]\s+.*/)) {
              e.preventDefault();
              isProcessing = true;
              setTimeout(() => {
                  convertUnorderedList(blockElement, text);
                  isProcessing = false;
              }, 0);
              return;
          }
          
          if (text.match(/^\d+\.\s+.*/)) {
              e.preventDefault();
              isProcessing = true;
              setTimeout(() => {
                  convertOrderedList(blockElement, text);
                  isProcessing = false;
              }, 0);
              return;
          }
          
          // コードブロックの開始
          if (text.trim() === '```') {
              e.preventDefault();
              isProcessing = true;
              setTimeout(() => {
                  convertCodeBlockStart(blockElement);
                  isProcessing = false;
              }, 0);
              return;
          }
      }
      
      // スペースが入力された場合
      if (e.data === ' ') {
          // 見出しの処理（# + スペース）
          if (text.match(/^#{1,6}$/)) {
              e.preventDefault();
              isProcessing = true;
              setTimeout(() => {
                  // スペースは後で追加されるので、見出し変換は次のinputで
              }, 0);
              return;
          }
          
          // リストの処理（- や数字. + スペース）
          if (text.match(/^[-*+]$/) || text.match(/^\d+\.$/)) {
              // スペースは後で追加されるので、リスト変換は次のinputで
              return;
          }
      }
  });
  
  // inputイベントで処理（スペース入力後など）
  editorEl.addEventListener('input', (e) => {
      if (isProcessing) return;
      
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const blockElement = getBlockElement(range);
      if (!blockElement) return;
      
      // コードブロック内は処理しない
      if (blockElement.tagName === 'PRE' || blockElement.closest('pre')) {
          return;
      }
      
      const text = blockElement.textContent || '';
      
      // 見出しの処理（# + スペース + テキスト）
      if (text.match(/^#{1,6}\s+.+/) && e.inputType === 'insertText' && e.data === ' ') {
          setTimeout(() => {
              if (!isProcessing) {
                  isProcessing = true;
                  convertHeading(blockElement, blockElement.textContent);
                  isProcessing = false;
              }
          }, 10);
      }
      
      // リストの処理（- + スペース + テキスト）
      if ((text.match(/^[-*+]\s+.+/) || text.match(/^\d+\.\s+.+/)) && 
          e.inputType === 'insertText' && e.data === ' ') {
          setTimeout(() => {
              if (!isProcessing) {
                  isProcessing = true;
                  if (text.match(/^[-*+]\s+/)) {
                      convertUnorderedList(blockElement, blockElement.textContent);
                  } else {
                      convertOrderedList(blockElement, blockElement.textContent);
                  }
                  isProcessing = false;
              }
          }, 10);
      }
      
      // インラインのマークダウン記法を処理（少し遅延させて入力完了を待つ）
      setTimeout(() => {
          if (!isProcessing) {
              processInlineMarkdown(editorEl);
          }
      }, 100);
  });
  
  // Enterキーでリストの継続
  editorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
          const selection = window.getSelection();
          if (!selection.rangeCount) return;
          
          const range = selection.getRangeAt(0);
          
          // コードブロック内の場合は処理しない（syntax-highlight.jsで処理される）
          let node = range.startContainer;
          if (node.nodeType === Node.TEXT_NODE) {
              node = node.parentElement;
          }
          // code要素を探す
          while (node && node !== editorEl) {
              if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                  const codeElement = node;
                  if (!codeElement.classList.contains('no-highlight')) {
                      return; // コードブロック内の場合は処理しない
                  }
              }
              node = node.parentElement;
          }
          
          const blockElement = getBlockElement(range);
          if (!blockElement) return;
          
          // リストアイテム内の場合、次のリストアイテムを作成
          if (blockElement.tagName === 'LI') {
              const list = blockElement.parentElement;
              const newLi = document.createElement('li');
              newLi.innerHTML = '<br>';
              
              if (blockElement.textContent.trim() === '') {
                  // 空のリストアイテムの場合はリストを終了
                  e.preventDefault();
                  const p = document.createElement('p');
                  p.innerHTML = '<br>';
                  
                  list.parentElement.insertBefore(p, list.nextSibling);
                  blockElement.remove();
                  
                  if (list.children.length === 0) {
                      list.remove();
                  }
                  
                  range.setStart(p, 0);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
              } else {
                  // 次のリストアイテムを作成
                  list.insertBefore(newLi, blockElement.nextSibling);
                  range.setStart(newLi, 0);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
              }
          }
          
          // 見出しの後のEnterで通常の段落に戻る
          if (/^H[1-6]$/.test(blockElement.tagName) && blockElement.textContent.trim() === '') {
              e.preventDefault();
              const p = document.createElement('p');
              p.innerHTML = '<br>';
              
              blockElement.parentElement.insertBefore(p, blockElement.nextSibling);
              blockElement.remove();
              
              range.setStart(p, 0);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
          }
      }
  });
}

function getBlockElement(range) {
  let node = range.startContainer;
  
  if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
  }
  
  // ブロック要素を見つける
  while (node && node !== range.commonAncestorContainer.parentElement && node !== document.body) {
      if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'PRE', 'BLOCKQUOTE'].includes(node.tagName)) {
          return node;
      }
      node = node.parentElement;
  }
  
  // 見つからない場合は、範囲を囲む要素を返す
  return node && node.tagName !== 'BODY' ? node : null;
}

function convertHeading(blockElement, text) {
  const match = text.match(/^(#{1,6})\s+(.*)/);
  if (!match) return;
  
  const level = match[1].length;
  const content = match[2];
  
  const h = document.createElement(`h${level}`);
  h.textContent = content;
  
  blockElement.parentElement.replaceChild(h, blockElement);
  
  // カーソルを見出しの後に移動
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  h.parentElement.insertBefore(p, h.nextSibling);
  
  const range = document.createRange();
  range.setStart(p, 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function convertUnorderedList(blockElement, text) {
  const match = text.match(/^[-*+]\s+(.*)/);
  if (!match) return;
  
  const content = match[1];
  
  let ul = blockElement.previousElementSibling;
  if (!ul || ul.tagName !== 'UL') {
      ul = document.createElement('ul');
      blockElement.parentElement.insertBefore(ul, blockElement);
  }
  
  const li = document.createElement('li');
  li.textContent = content;
  ul.appendChild(li);
  
  blockElement.remove();
  
  // カーソルをリストアイテム内に移動
  const range = document.createRange();
  range.setStart(li, li.childNodes.length || 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function convertOrderedList(blockElement, text) {
  const match = text.match(/^\d+\.\s+(.*)/);
  if (!match) return;
  
  const content = match[1];
  
  let ol = blockElement.previousElementSibling;
  if (!ol || ol.tagName !== 'OL') {
      ol = document.createElement('ol');
      blockElement.parentElement.insertBefore(ol, blockElement);
  }
  
  const li = document.createElement('li');
  li.textContent = content;
  ol.appendChild(li);
  
  blockElement.remove();
  
  // カーソルをリストアイテム内に移動
  const range = document.createRange();
  range.setStart(li, li.childNodes.length || 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function convertCodeBlockStart(blockElement) {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = '\n';
  pre.appendChild(code);
  
  blockElement.parentElement.replaceChild(pre, blockElement);
  
  const range = document.createRange();
  range.setStart(code, 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function processInlineMarkdown(editorEl) {
  // インラインのマークダウン記法を処理
  const walker = document.createTreeWalker(
      editorEl,
      NodeFilter.SHOW_TEXT,
      {
          acceptNode: (node) => {
              // コードブロック内や既にフォーマット済みの要素は除外
              const parent = node.parentElement;
              if (!parent) {
                  return NodeFilter.FILTER_REJECT;
              }
              
              if (parent.tagName === 'CODE' || 
                  parent.tagName === 'PRE' ||
                  parent.closest('pre') ||
                  parent.closest('code') ||
                  parent.tagName === 'STRONG' ||
                  parent.tagName === 'EM' ||
                  parent.tagName === 'A') {
                  return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
          }
      }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
      if (node.textContent.match(/\*\*.*?\*\*|_.*?_|`.*?`|\[.*?\]\(.*?\)/)) {
          textNodes.push(node);
      }
  }
  
  textNodes.forEach(textNode => {
      const text = textNode.textContent;
      const parent = textNode.parentElement;
      
      // 太字 **text** を優先（斜体よりも先に処理）
      if (text.includes('**')) {
          const parts = text.split(/(\*\*[^*]+\*\*|\*\*[^*]*\*\*)/);
          const fragment = document.createDocumentFragment();
          
          parts.forEach(part => {
              if (part.startsWith('**') && part.endsWith('**')) {
                  const strong = document.createElement('strong');
                  strong.textContent = part.slice(2, -2);
                  fragment.appendChild(strong);
              } else if (part && part !== '') {
                  // さらに他のマークダウン記法を処理
                  processTextNode(part, fragment);
              }
          });
          
          if (fragment.childNodes.length > 0) {
              parent.replaceChild(fragment, textNode);
          }
          return;
      }
      
      // その他のマークダウン記法
      processTextNode(text, parent, textNode);
  });
}

function processTextNode(text, container, originalNode) {
  const fragment = document.createDocumentFragment();
  
  // リンク [text](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = linkPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
          processOtherMarkdown(text.substring(lastIndex, match.index), fragment);
      }
      
      const link = document.createElement('a');
      link.href = match[2];
      link.textContent = match[1];
      fragment.appendChild(link);
      
      lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
      processOtherMarkdown(text.substring(lastIndex), fragment);
  } else if (lastIndex === 0) {
      processOtherMarkdown(text, fragment);
  }
  
  if (fragment.childNodes.length > 0 && originalNode) {
      container.replaceChild(fragment, originalNode);
  } else if (fragment.childNodes.length > 0) {
      container.appendChild(fragment);
  }
}

function processOtherMarkdown(text, fragment) {
  // インラインコード `code`
  if (text.includes('`')) {
      const parts = text.split(/(`[^`]+`)/);
      parts.forEach(part => {
          if (part.startsWith('`') && part.endsWith('`')) {
              const code = document.createElement('code');
              code.textContent = part.slice(1, -1);
              fragment.appendChild(code);
          } else if (part) {
              // 斜体 *text* または _text_
              if (part.includes('*') || part.includes('_')) {
                  const parts2 = part.split(/(\*[^*]+\*|_[^_]+_)/);
                  parts2.forEach(part2 => {
                      if ((part2.startsWith('*') && part2.endsWith('*') && !part2.startsWith('**')) ||
                          (part2.startsWith('_') && part2.endsWith('_'))) {
                          const em = document.createElement('em');
                          em.textContent = part2.slice(1, -1);
                          fragment.appendChild(em);
                      } else if (part2) {
                          fragment.appendChild(document.createTextNode(part2));
                      }
                  });
              } else {
                  fragment.appendChild(document.createTextNode(part));
              }
          }
      });
  } else {
      // 斜体 *text* または _text_
      if (text.includes('*') || text.includes('_')) {
          const parts = text.split(/(\*[^*]+\*|_[^_]+_)/);
          parts.forEach(part => {
              if ((part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) ||
                  (part.startsWith('_') && part.endsWith('_'))) {
                  const em = document.createElement('em');
                  em.textContent = part.slice(1, -1);
                  fragment.appendChild(em);
              } else if (part) {
                  fragment.appendChild(document.createTextNode(part));
              }
          });
      } else {
          fragment.appendChild(document.createTextNode(text));
      }
  }
}
