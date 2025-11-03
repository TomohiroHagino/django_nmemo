// シンタックスハイライト機能
export function setupSyntaxHighlight(editor) {
    const editorEl = editor.editor;
    
    // コードブロック挿入中フラグを設定
    if (!editor._syntaxHighlightSetup) {
        editor._syntaxHighlightSetup = {};
    }
    let isInsertingCodeBlock = false;
    editor._syntaxHighlightSetup.isInsertingCodeBlock = isInsertingCodeBlock;
    
    // フラグを更新する関数を公開
    Object.defineProperty(editor._syntaxHighlightSetup, 'isInsertingCodeBlock', {
        get: () => isInsertingCodeBlock,
        set: (value) => {
            isInsertingCodeBlock = value;
        }
    });
    
    // hljsへのアクセスを統一
    const getHljs = () => {
        if (typeof window !== 'undefined' && window.hljs) {
            return window.hljs;
        }
        if (typeof hljs !== 'undefined') {
            return hljs;
        }
        return null;
    };
    
    function highlightCodeBlocks() {
        const hljs = getHljs();
        if (!hljs || !hljs.highlightElement) {
            console.warn('highlight.js is not loaded');
            return;
        }
        
        const codeBlocks = editorEl.querySelectorAll('pre code:not(.hljs):not(.no-highlight)');
        
        if (codeBlocks.length === 0) {
            return;
        }
        
        console.log(`Found ${codeBlocks.length} code blocks to highlight`);
        
        codeBlocks.forEach((code, index) => {
            const textContent = code.textContent || code.innerText;
            if (!textContent || !textContent.trim()) {
                return;
            }
            
            // no-highlightクラスまたはコメントが含まれている場合はスキップ
            if (code.classList.contains('no-highlight') ||
                textContent.trim().startsWith('<!-- no-highlight -->') || 
                textContent.trim().startsWith('// no-highlight') ||
                textContent.trim().startsWith('/* no-highlight */')) {
                return;
            }
            
            try {
                // highlight.jsでハイライトを適用
                hljs.highlightElement(code);
                console.log(`Highlighted code block ${index + 1}`);
            } catch (err) {
                console.warn('Error highlighting code:', err);
            }
        });
    }
    
    // カーソル位置を保存する関数
    function saveCursorPosition(codeElement) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        
        const range = selection.getRangeAt(0);
        
        // カーソルがこのコードブロック内にない場合はnullを返す
        if (!codeElement.contains(range.startContainer) && 
            !codeElement.contains(range.commonAncestorContainer)) {
            return null;
        }
        
        // カーソル位置をテキスト内のオフセットとして計算
        const textContent = codeElement.textContent || codeElement.innerText;
        let cursorOffset = 0;
        
        const textNodes = [];
        const walker = document.createTreeWalker(
            codeElement,
            NodeFilter.SHOW_TEXT,
            null
        );
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        // カーソル位置までのオフセットを計算
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            if (range.startContainer === textNode) {
                cursorOffset += range.startOffset;
                break;
            } else {
                cursorOffset += textNode.textContent.length;
            }
        }
        
        // カーソル位置がテキスト範囲外の場合は調整
        cursorOffset = Math.min(cursorOffset, textContent.length);
        
        return cursorOffset;
    }
    
    // カーソル位置を復元する関数
    function restoreCursorPosition(codeElement, offset) {
        if (offset === null || offset === undefined) return false;
        
        const selection = window.getSelection();
        if (!selection.rangeCount && offset > 0) {
            // 選択範囲がない場合でも、offset > 0ならカーソルを設定
        }
        
        // テキストノードを取得
        const textNodes = [];
        const walker = document.createTreeWalker(
            codeElement,
            NodeFilter.SHOW_TEXT,
            null
        );
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        // オフセット位置に該当するテキストノードを探す
        let currentOffset = 0;
        let targetNode = null;
        let targetOffset = 0;
        
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            const nodeLength = textNode.textContent.length;
            
            if (currentOffset + nodeLength >= offset) {
                targetNode = textNode;
                targetOffset = offset - currentOffset;
                break;
            }
            currentOffset += nodeLength;
        }
        
        // テキストノードが見つからない場合（空の場合など）
        if (!targetNode) {
            if (textNodes.length > 0) {
                // 最後のテキストノードの末尾にカーソルを配置
                targetNode = textNodes[textNodes.length - 1];
                targetOffset = targetNode.textContent.length;
            } else {
                // テキストノードがない場合は作成
                targetNode = document.createTextNode('');
                codeElement.appendChild(targetNode);
                targetOffset = 0;
            }
        }
        
        // カーソル位置を設定
        try {
            const range = document.createRange();
            range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        } catch (err) {
            console.warn('Error restoring cursor position:', err);
            return false;
        }
    }
    
    // 単一のコードブロックをハイライト
    function highlightCodeBlock(codeElement, force = false) {
        const hljs = getHljs();
        if (!codeElement || !hljs || !hljs.highlight) {
            return;
        }
        
        // no-highlightクラスの場合はスキップ
        if (codeElement.classList.contains('no-highlight')) {
            return;
        }
        
        // 既にハイライト済みで、force=falseの場合はスキップ
        if (!force && codeElement.classList.contains('hljs')) {
            return;
        }
        
        const textContent = codeElement.textContent || codeElement.innerText;
        
        // 空のコードブロックでも処理する（入力前でもクラスを設定）
        if (!textContent && !force) {
            // 空の場合は自動検出のためにクラスだけ設定
            if (!codeElement.className || codeElement.className === '') {
                return; // 言語クラスがない場合は何もしない
            }
        }
        
        try {
            // ハイライト適用中フラグを設定（MutationObserverを一時的に無効化）
            if (!editor._syntaxHighlightSetup) {
                editor._syntaxHighlightSetup = {};
            }
            editor._syntaxHighlightSetup.isHighlighting = true;
            
            // カーソル位置を保存（ハイライト適用前）
            const savedCursorOffset = saveCursorPosition(codeElement);
            
            // 既存のハイライトをクリア（force=trueの場合）
            if (force && (codeElement.classList.contains('hljs') || codeElement.hasAttribute('data-highlighted'))) {
                // innerHTMLをクリアして、元のテキストに戻す
                const text = codeElement.textContent || codeElement.innerText;
                // 元の言語クラスを保持（language-undefined以外）
                const originalLanguageClass = Array.from(codeElement.classList)
                    .find(cls => cls.startsWith('language-') && cls !== 'language-undefined' && cls !== 'language-plaintext');
                
                if (text && text.trim()) {
                    codeElement.classList.remove('hljs');
                    // data-highlighted属性を削除（highlight.jsの再ハイライトを許可するため）
                    codeElement.removeAttribute('data-highlighted');
                    // highlight.jsが自動追加した可能性のある言語クラスを削除
                    codeElement.classList.remove('language-undefined');
                    codeElement.classList.remove('language-plaintext');
                    // すべての子要素を削除して、テキストノードのみ残す
                    while (codeElement.firstChild) {
                        codeElement.removeChild(codeElement.firstChild);
                    }
                    // テキストノードを作成して追加
                    codeElement.appendChild(document.createTextNode(text));
                    
                    // 元の言語クラスを復元（空文字列の場合はそのまま）
                    if (originalLanguageClass) {
                        codeElement.className = originalLanguageClass;
                    } else if (!codeElement.className || codeElement.className === '') {
                        // 空文字列の場合は、そのまま保持（highlight.jsが自動検出を試みる）
                        codeElement.className = '';
                    }
                    
                    // カーソル位置を復元（ハイライト解除後）
                    if (savedCursorOffset !== null) {
                        restoreCursorPosition(codeElement, savedCursorOffset);
                    }
                }
            }
            
            // テキストがある場合はハイライトを適用
            if (textContent && textContent.trim()) {
                // highlight.jsでハイライトを適用
                try {
                    // ハイライト適用前に、pre要素への参照を保持
                    const preElement = codeElement.parentElement;
                    if (!preElement || preElement.tagName !== 'PRE') {
                        console.warn('Code element parent is not PRE, skipping highlight');
                        return;
                    }
                    
                    // ハイライト適用前に、エディタ要素への参照を保持
                    const editorElParent = preElement.parentElement;
                    const preElementNextSibling = preElement.nextSibling;
                    
                    // ハイライト適用前のテキスト内容を保持
                    const originalText = codeElement.textContent || codeElement.innerText;
                    
                    // 常にhighlightAutoを使用して自動検出
                    if (hljs.highlightAuto) {
                        const result = hljs.highlightAuto(originalText);
                        if (result && result.value) {
                            codeElement.innerHTML = result.value;
                            // 検出された言語クラスを設定（検出できなかった場合は空文字列）
                            codeElement.className = result.language ? `language-${result.language}` : '';
                            codeElement.classList.add('hljs');
                            codeElement.setAttribute('data-highlighted', 'yes');
                            console.log('Auto-detected language:', result.language, codeElement.className);
                        } else {
                            // 自動検出に失敗した場合は、クラスなしでハイライトなしとして扱う
                            codeElement.className = '';
                            console.log('Auto-detection failed, no language detected');
                        }
                    } else {
                        // highlightAutoがない場合は、highlightElementを使用（フォールバック）
                        hljs.highlightElement(codeElement);
                    }
                    console.log('Highlighted code block:', codeElement.className);
                    
                    // カーソル位置を復元（ハイライト適用後）
                    if (savedCursorOffset !== null) {
                        // requestAnimationFrameでDOM更新後にカーソル位置を復元
                        requestAnimationFrame(() => {
                            restoreCursorPosition(codeElement, savedCursorOffset);
                        });
                    }
                    
                    // ハイライト適用直後に、ハイライトが確実に適用されているか確認
                    requestAnimationFrame(() => {
                        const hasHighlight = codeElement.classList.contains('hljs');
                        const hasHighlightedAttribute = codeElement.hasAttribute('data-highlighted');
                        
                        if (!hasHighlight && !hasHighlightedAttribute && textContent && textContent.trim()) {
                            console.warn('Highlight was not applied, attempting to reapply...');
                            // ハイライトが適用されていない場合は再試行
                            try {
                                // カーソル位置を再保存（再ハイライト前）
                                const reSavedCursorOffset = saveCursorPosition(codeElement);
                                hljs.highlightElement(codeElement);
                                // カーソル位置を再復元（再ハイライト後）
                                if (reSavedCursorOffset !== null) {
                                    requestAnimationFrame(() => {
                                        restoreCursorPosition(codeElement, reSavedCursorOffset);
                                    });
                                }
                            } catch (err) {
                                console.error('Error reapplying highlight:', err);
                            }
                        }
                        
                        // コードブロックがまだ存在することを確認
                        const currentPre = codeElement.parentElement;
                        if (!currentPre || currentPre.tagName !== 'PRE' || !editorEl.contains(currentPre)) {
                            console.warn('Code block structure broken immediately after highlighting, attempting to restore');
                            // コードブロックを復元
                            const restoredPre = document.createElement('pre');
                            const restoredCode = document.createElement('code');
                            restoredCode.className = codeElement.className;
                            restoredCode.textContent = originalText;
                            restoredPre.appendChild(restoredCode);
                            
                            // 元の位置に挿入
                            if (editorElParent === editorEl && preElementNextSibling) {
                                editorEl.insertBefore(restoredPre, preElementNextSibling);
                            } else if (editorElParent === editorEl) {
                                editorEl.appendChild(restoredPre);
                            }
                            
                            // codeElementの参照を更新
                            codeElement = restoredCode;
                            
                            // カーソル位置を復元（コードブロック復元後）
                            if (savedCursorOffset !== null) {
                                restoreCursorPosition(codeElement, savedCursorOffset);
                            }
                        }
                    });
                    
                    // ハイライト適用完了後、少し待ってからフラグを解除
                    // フラグ解除前に、コードブロックがまだ存在することを確認
                    setTimeout(() => {
                        // コードブロックが削除されていないことを確認
                        const preElement = codeElement.parentElement;
                        if (preElement && preElement.tagName === 'PRE' && preElement.parentElement) {
                            // さらに、code要素がpre要素の直接の子要素であることを確認
                            if (codeElement.parentElement === preElement && editorEl.contains(preElement)) {
                                if (editor._syntaxHighlightSetup) {
                                    editor._syntaxHighlightSetup.isHighlighting = false;
                                    console.log('Highlighting flag cleared (code block still exists)');
                                }
                            } else {
                                console.warn('Code block structure invalid after highlighting, keeping flag');
                            }
                        } else {
                            console.warn('Code block was removed before flag clearing, keeping flag');
                            // コードブロックが削除されている場合はフラグを保持して保護を継続
                        }
                    }, 500); // 500msに延長
                } catch (err) {
                    console.warn('Error during highlight application:', err);
                    throw err;
                }
            } else {
                // 空の場合は、言語クラスだけ設定（入力待ち）
                // highlightElementは呼ばないが、クラスは保持
                // フラグを解除（テキストがない場合は即座に解除）
                setTimeout(() => {
                    if (editor._syntaxHighlightSetup) {
                        editor._syntaxHighlightSetup.isHighlighting = false;
                    }
                }, 100);
            }
    } catch (err) {
            // フラグを解除
            if (editor._syntaxHighlightSetup) {
                editor._syntaxHighlightSetup.isHighlighting = false;
            }
        }
    }
    
    // コードブロック内かどうかを判定するヘルパー関数
    function isInCodeBlock(range) {
        if (!range) return null;
        
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        // code要素を探す
        while (node && node !== editorEl && node !== document.body) {
            if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                const codeElement = node;
                if (!codeElement.classList.contains('no-highlight')) {
                    return codeElement;
                }
            }
            node = node.parentElement;
        }
        return null;
    }
    
    // カーソルを<code>要素内に確実に配置する関数
    function ensureCursorInCodeElement(preElement, selection) {
        if (!preElement || !selection) return null;
        
        const codeElement = preElement.querySelector('code');
        if (!codeElement) return null;
        
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!range) return null;
        
        // カーソルが<pre>要素内にあるが、<code>要素内にない場合
        if (preElement.contains(range.startContainer)) {
            let currentNode = range.startContainer;
            if (currentNode.nodeType === Node.TEXT_NODE) {
                currentNode = currentNode.parentElement;
            }
            
            // <code>要素内にいない場合
            if (!codeElement.contains(currentNode)) {
                // <code>要素内のテキストノードを探すか作成
                const textNodes = [];
                const walker = document.createTreeWalker(
                    codeElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let node;
                while (node = walker.nextNode()) {
                    textNodes.push(node);
                }
                
                let targetTextNode;
                if (textNodes.length > 0) {
                    targetTextNode = textNodes[textNodes.length - 1];
                } else {
                    targetTextNode = document.createTextNode('');
                    codeElement.appendChild(targetTextNode);
                }
                
                // カーソルを<code>要素内に移動
                const newRange = document.createRange();
                newRange.setStart(targetTextNode, targetTextNode.textContent.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                return codeElement;
            }
        }
        
        return codeElement;
    }
    
    // beforeinputイベントでコードブロック内のすべての入力を処理
    editorEl.addEventListener('beforeinput', (e) => {
        // コードブロック挿入中は処理しない
        if (editor._syntaxHighlightSetup && editor._syntaxHighlightSetup.isInsertingCodeBlock) {
            return;
        }
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const codeElement = isInCodeBlock(range);
        
        // no-highlightクラスのコードブロックも検出
        let noHighlightCodeElement = null;
        if (!codeElement) {
            // isInCodeBlockがnullを返した場合、no-highlightクラスのコードブロックをチェック
            let node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentElement;
            }
            while (node && node !== editorEl && node !== document.body) {
                if (node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE') {
                    if (node.classList.contains('no-highlight')) {
                        noHighlightCodeElement = node;
                        break;
                    }
                }
                node = node.parentElement;
            }
        }
        
        // コードブロック内でない場合は何もしない
        if (!codeElement && !noHighlightCodeElement) {
            beforeInputHandled = false;
            return;
        }
        
        // 使用するcode要素を決定
        const targetCodeElement = codeElement || noHighlightCodeElement;
        
        // <pre>要素を取得
        const preElement = targetCodeElement.parentElement;
        if (!preElement || preElement.tagName !== 'PRE') {
            beforeInputHandled = false;
            return;
        }
        
        // コードブロック内の場合は、すべての入力をインターセプトして手動で処理
        
        // 通常のテキスト入力
        if (e.inputType === 'insertText' && e.data && e.data !== '\n') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // beforeinputで入力を処理したことをマーク
            beforeInputHandled = true;
            
            // カーソル位置を確実に<code>要素内に設定
            ensureCursorInCodeElement(preElement, selection);
            const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!currentRange) return;
            
            // no-highlightクラスの場合は通常のテキストノードのみなので、シンプルに処理
            const isNoHighlight = targetCodeElement.classList.contains('no-highlight');
            
            if (isNoHighlight) {
                // no-highlightクラスの場合：テキストノードに直接挿入
                let textNode = currentRange.startContainer;
                if (textNode.nodeType !== Node.TEXT_NODE || !targetCodeElement.contains(textNode)) {
                    // テキストノードを取得
                    const textNodes = [];
                    const walker = document.createTreeWalker(
                        targetCodeElement,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let tn;
                    while (tn = walker.nextNode()) {
                        textNodes.push(tn);
                    }
                    textNode = textNodes[0] || targetCodeElement.appendChild(document.createTextNode(''));
                }
                
                // カーソル位置までのオフセットを計算
                let offset = 0;
                if (textNode === currentRange.startContainer) {
                    offset = currentRange.startOffset;
                } else {
                    // テキストノードまでのオフセットを計算
                    const textNodes = [];
                    const walker = document.createTreeWalker(
                        targetCodeElement,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let tn;
                    while (tn = walker.nextNode()) {
                        if (tn === textNode) break;
                        offset += tn.textContent.length;
                    }
                }
                
                // テキストを挿入
                const text = textNode.textContent;
                textNode.textContent = text.slice(0, offset) + e.data + text.slice(offset);
                
                // カーソル位置を更新
                const newRange = document.createRange();
                newRange.setStart(textNode, offset + e.data.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                beforeInputHandled = false;
                return false;
            }
            
            // ハイライトありのコードブロックの処理（既存のコードをtargetCodeElementに置き換え）
            const currentText = targetCodeElement.textContent || targetCodeElement.innerText;
            const originalRange = currentRange.cloneRange();
            
            // カーソル位置をテキスト内のオフセットとして計算
            let cursorOffset = 0;
            const textNodes = [];
            const walker = document.createTreeWalker(
                targetCodeElement,
                NodeFilter.SHOW_TEXT,
                null
            );
            let tn;
            while (tn = walker.nextNode()) {
                textNodes.push(tn);
            }
            
            // カーソル位置までのオフセットを計算
            for (let i = 0; i < textNodes.length; i++) {
                const node = textNodes[i];
                if (originalRange.startContainer === node) {
                    cursorOffset += originalRange.startOffset;
                    break;
                } else {
                    cursorOffset += node.textContent.length;
                }
            }
            
            // ハイライトあり・なしに関わらず、DOM構造をクリアしてテキストノードに変換
            const beforeText = currentText.substring(0, cursorOffset);
            const afterText = currentText.substring(cursorOffset);
            const newText = beforeText + e.data + afterText;
            
            while (targetCodeElement.firstChild) {
                targetCodeElement.removeChild(targetCodeElement.firstChild);
            }
            
            const newTextNode = document.createTextNode(newText);
            targetCodeElement.appendChild(newTextNode);
            
            const newRange = document.createRange();
            newRange.setStart(newTextNode, cursorOffset + e.data.length);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // 最後に編集中のコードブロックを記録
            if (!editor._syntaxHighlightSetup.lastEditedCodeBlock) {
                editor._syntaxHighlightSetup.lastEditedCodeBlock = targetCodeElement;
            } else {
                editor._syntaxHighlightSetup.lastEditedCodeBlock = targetCodeElement;
            }
            
            // フラグをリセット（次の入力のため）
            beforeInputHandled = false;
            
            return false;
        }
        
        // 改行の挿入を検出
        if (e.inputType === 'insertLineBreak' || 
            e.inputType === 'insertParagraph' ||
            (e.inputType === 'insertText' && e.data === '\n') ||
            (e.inputType === 'insertText' && e.data === null)) {
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // カーソル位置を確実に<code>要素内に設定
            ensureCursorInCodeElement(preElement, selection);
            const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            if (!currentRange) return;
            
            // no-highlightクラスの場合は通常のテキストノードのみなので、シンプルに処理
            const isNoHighlight = targetCodeElement.classList.contains('no-highlight');
            
            if (isNoHighlight) {
                // no-highlightクラスの場合：テキストノードに直接改行を挿入
                let textNode = currentRange.startContainer;
                if (textNode.nodeType !== Node.TEXT_NODE || !targetCodeElement.contains(textNode)) {
                    const textNodes = [];
                    const walker = document.createTreeWalker(
                        targetCodeElement,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let tn;
                    while (tn = walker.nextNode()) {
                        textNodes.push(tn);
                    }
                    textNode = textNodes[0] || targetCodeElement.appendChild(document.createTextNode(''));
                }
                
                let offset = currentRange.startOffset;
                if (textNode !== currentRange.startContainer) {
                    offset = 0;
                    const textNodes = [];
                    const walker = document.createTreeWalker(
                        targetCodeElement,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let tn;
                    while (tn = walker.nextNode()) {
                        if (tn === textNode) break;
                        offset += tn.textContent.length;
                    }
                }
                
                const text = textNode.textContent;
                textNode.textContent = text.slice(0, offset) + '\n' + text.slice(offset);
                
                const newRange = document.createRange();
                newRange.setStart(textNode, offset + 1);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                if (!editor._syntaxHighlightSetup.lastEditedCodeBlock) {
                    editor._syntaxHighlightSetup.lastEditedCodeBlock = targetCodeElement;
                } else {
                    editor._syntaxHighlightSetup.lastEditedCodeBlock = targetCodeElement;
                }
                
                return false;
            }
            
            // ハイライトありのコードブロックの処理
            const currentText = targetCodeElement.textContent || targetCodeElement.innerText;
            const originalRange = currentRange.cloneRange();
            
            // カーソル位置をテキスト内のオフセットとして計算
            let cursorOffset = 0;
            const textNodes = [];
            const walker = document.createTreeWalker(
                targetCodeElement,
                NodeFilter.SHOW_TEXT,
                null
            );
            let tn;
            while (tn = walker.nextNode()) {
                textNodes.push(tn);
            }
            
            // カーソル位置までのオフセットを計算
            for (let i = 0; i < textNodes.length; i++) {
                const node = textNodes[i];
                if (originalRange.startContainer === node) {
                    cursorOffset += originalRange.startOffset;
                    break;
                } else {
                    cursorOffset += node.textContent.length;
                }
            }
            
            // ハイライトあり・なしに関わらず、DOM構造をクリアしてテキストノードに変換
            const beforeText = currentText.substring(0, cursorOffset);
            const afterText = currentText.substring(cursorOffset);
            const newText = beforeText + '\n' + afterText;
            
            while (targetCodeElement.firstChild) {
                targetCodeElement.removeChild(targetCodeElement.firstChild);
            }
            
            const newTextNode = document.createTextNode(newText);
            targetCodeElement.appendChild(newTextNode);
            
            const newRange = document.createRange();
            newRange.setStart(newTextNode, cursorOffset + 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            // 最後に編集中のコードブロックを記録
            if (!editor._syntaxHighlightSetup.lastEditedCodeBlock) {
                editor._syntaxHighlightSetup.lastEditedCodeBlock = targetCodeElement;
            } else {
                editor._syntaxHighlightSetup.lastEditedCodeBlock = targetCodeElement;
            }
            
            // 改行入力後はハイライトを再適用しない（コードブロックから抜けたときにのみ適用）
            return false;
        }
        
        // その他の入力タイプ（削除、ペーストなど）もインターセプト
        if (e.inputType === 'deleteContent' || 
            e.inputType === 'deleteContentBackward' || 
            e.inputType === 'deleteContentForward' ||
            e.inputType === 'insertFromPaste' ||
            e.inputType === 'insertFromDrop') {
            // カーソル位置を確認
            if (!codeElement.contains(range.startContainer)) {
                ensureCursorInCodeElement(preElement, selection);
            }
        }
    }, true); // capture: true で先に処理
    
    // keydownイベントでもEnterキーを処理（最優先）
    function handleCodeBlockEnter(e) {
        if (e.key !== 'Enter' && e.keyCode !== 13) {
            return;
        }
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let codeElement = isInCodeBlock(range);
        
        // <pre>要素内だが<code>要素外にカーソルがある場合
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        const preElement = node.closest('pre');
        if (preElement && preElement.parentElement === editorEl && !codeElement) {
            codeElement = ensureCursorInCodeElement(preElement, selection);
            if (!codeElement) return;
        }
        
        if (!codeElement) {
            return; // コードブロック内でない場合は処理しない
        }
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // カーソル位置を再確認
        ensureCursorInCodeElement(preElement, selection);
        
        const newRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!newRange) return;
        
        // 改行を挿入
        const textNode = newRange.startContainer;
        const offset = newRange.startOffset;
        
        let targetTextNode = textNode;
        if (textNode.nodeType !== Node.TEXT_NODE || !codeElement.contains(textNode)) {
            // code要素内のテキストノードを探す
            const walker = document.createTreeWalker(
                codeElement,
                NodeFilter.SHOW_TEXT,
                null
            );
            targetTextNode = walker.nextNode();
            
            // テキストノードがない場合は作成
            if (!targetTextNode) {
                targetTextNode = document.createTextNode('');
                codeElement.appendChild(targetTextNode);
            }
        }
        
        // 改行を挿入
        const text = targetTextNode.textContent || '';
        const before = text.substring(0, offset);
        const after = text.substring(offset);
        
        targetTextNode.textContent = before + '\n' + after;
        
        // カーソルを改行の後に移動
        const cursorRange = document.createRange();
        cursorRange.setStart(targetTextNode, offset + 1);
        cursorRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(cursorRange);
        
        // ハイライトを再適用
        setTimeout(() => {
            highlightCodeBlock(codeElement);
        }, 50);
    }
    
    // Enterキーの処理（capture: trueで最優先処理）
    editorEl.addEventListener('keydown', handleCodeBlockEnter, true);
    
    // コードブロック内での入力処理と<br>タグの削除
    let inputTimeout = null;
    let isProcessingInput = false;
    let beforeInputHandled = false;
    
    // <br>タグを改行文字に変換する関数
    function cleanupBrTags(codeElement) {
        const brElements = codeElement.querySelectorAll('br');
        if (brElements.length === 0) return false;
        
        let hasChanges = false;
        
        brElements.forEach(br => {
            const parent = br.parentNode;
            
            // <br>の前後のテキストノードを取得
            const prevSibling = br.previousSibling;
            const nextSibling = br.nextSibling;
            
            // 既存のテキストノードを利用するか、新しく作成
            let textNode;
            if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
                textNode = prevSibling;
                textNode.textContent += '\n';
                if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                    textNode.textContent += nextSibling.textContent;
                    nextSibling.remove();
                }
                br.remove();
            } else if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                textNode = nextSibling;
                textNode.textContent = '\n' + textNode.textContent;
                br.remove();
            } else {
                textNode = document.createTextNode('\n');
                parent.replaceChild(textNode, br);
            }
            
            hasChanges = true;
        });
        
        // コードブロック内の不要な要素（pre要素など）を削除
        const nestedPre = codeElement.querySelector('pre');
        if (nestedPre) {
            const text = nestedPre.textContent;
            const textNode = document.createTextNode(text);
            nestedPre.parentNode.replaceChild(textNode, nestedPre);
            hasChanges = true;
        }
        
        return hasChanges;
    }
    
    editorEl.addEventListener('input', (e) => {
        console.log('Input event fired');
        
        if (isProcessingInput) {
            console.log('Input event: isProcessingInput is true, skipping');
            return;
        }
        
        // コードブロック挿入中は処理しない
        if (editor._syntaxHighlightSetup && editor._syntaxHighlightSetup.isInsertingCodeBlock) {
            console.log('Input event: code block insertion in progress, skipping');
            return;
        }
        
        // beforeinputイベントで入力を処理した場合は、inputイベントの処理をスキップ
        if (beforeInputHandled) {
            console.log('Skipping input event because beforeinput was handled');
            return;
        }
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let codeElement = isInCodeBlock(range);

        // <pre>要素内のテキストを<code>要素内に移動
        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        
        const preElement = node.closest('pre');
        if (preElement && preElement.parentElement === editorEl) {
            const codeInPre = preElement.querySelector('code');
            
            // <pre>要素内に<code>要素がない場合は作成
            if (!codeInPre) {
                const newCode = document.createElement('code');
                // 既存のテキストノードを移動
                const textNodes = [];
                const walker = document.createTreeWalker(
                    preElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let textNode;
                while (textNode = walker.nextNode()) {
                    textNodes.push(textNode);
                }
                
                if (textNodes.length > 0) {
                    const fragment = document.createDocumentFragment();
                    textNodes.forEach(tn => {
                        fragment.appendChild(tn.cloneNode(true));
                        tn.remove();
                    });
                    newCode.appendChild(fragment);
                } else {
                    newCode.appendChild(document.createTextNode(''));
                }
                
                preElement.appendChild(newCode);
                codeElement = newCode;
            } else if (codeInPre && !codeInPre.classList.contains('no-highlight')) {
                // <pre>要素内に<code>要素外のテキストノードがあるかチェック
                const textNodes = [];
                const walker = document.createTreeWalker(
                    preElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let textNode;
                while (textNode = walker.nextNode()) {
                    if (!codeInPre.contains(textNode) && textNode.parentElement === preElement) {
                        textNodes.push(textNode);
                    }
                }
                
                // <code>要素外のテキストノードを<code>要素内に移動
                if (textNodes.length > 0) {
                    isProcessingInput = true;
                    
                    requestAnimationFrame(() => {
                        const codeTextNodes = [];
                        const codeWalker = document.createTreeWalker(
                            codeInPre,
                            NodeFilter.SHOW_TEXT,
                            null
                        );
                        let codeTextNode;
                        while (codeTextNode = codeWalker.nextNode()) {
                            codeTextNodes.push(codeTextNode);
                        }
                        
                        let targetCodeTextNode;
                        if (codeTextNodes.length > 0) {
                            targetCodeTextNode = codeTextNodes[codeTextNodes.length - 1];
                        } else {
                            targetCodeTextNode = document.createTextNode('');
                            codeInPre.appendChild(targetCodeTextNode);
                        }
                        
                        // テキストを結合
                        textNodes.forEach(tn => {
                            const text = tn.textContent;
                            tn.remove();
                            targetCodeTextNode.textContent += text;
                        });
                        
                        // カーソルを<code>要素内に移動
                        const newRange = document.createRange();
                        newRange.setStart(targetCodeTextNode, targetCodeTextNode.textContent.length);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        
                        codeElement = codeInPre;
                        isProcessingInput = false;
                    });
                } else {
                    codeElement = codeInPre;
                }
            }
        }
        
        if (codeElement && codeElement.parentElement && codeElement.parentElement.tagName === 'PRE') {
            isProcessingInput = true;
            
            // コードブロック内での入力時は、<br>タグを削除して正規化
            requestAnimationFrame(() => {
                if (codeElement && codeElement.parentElement && codeElement.parentElement.tagName === 'PRE') {
                    // コードブロック内での入力時は、beforeinputイベントで処理されている可能性が高い
                    // inputイベントの処理をスキップ（特に、コードブロックの削除処理を避ける）
                    console.log('Input event: skipping processing for code block input');
                    return; // コードブロック内での入力はbeforeinputで処理されているので、inputイベントの処理をスキップ
                }

                // 現在のコードブロック（codeElement）がまだ存在するか確認
                const currentCodeElement = codeElement;
                const currentPreElement = currentCodeElement ? currentCodeElement.parentElement : null;
                
                // コードブロックが存在しない場合は処理をスキップ
                if (!currentCodeElement || !currentPreElement || currentPreElement.tagName !== 'PRE') {
                    isProcessingInput = false;
                    return;
                }
                
                const hadChanges = cleanupBrTags(currentCodeElement);
                
                // 分割された<pre>要素をチェック（コードブロック内での入力時のみ）
                // 現在のコードブロック以外の<pre>要素のみをチェック
                const allPres = editorEl.querySelectorAll('pre');
                allPres.forEach((pre) => {
                    // 現在のコードブロックはスキップ（絶対に削除しない）
                    if (pre === currentPreElement) {
                        console.log('Skipping current code block');
                        return;
                    }
                    
                    // コードブロックを確認
                    const code = pre.querySelector('code');
                    
                    // 正常なコードブロック（code要素がpreの直接の子要素で、no-highlightクラスがない）は削除しない
                    if (code && code.parentElement === pre && !code.classList.contains('no-highlight')) {
                        console.log('Skipping valid code block');
                        return;
                    }
                    
                    // code要素がない、またはcode要素がpreの直接の子要素でない場合のみ削除対象
                    if (pre.parentElement === editorEl && (!code || code.parentElement !== pre)) {
                        console.log('Checking potentially split pre element:', pre);
                        // 分割された可能性のある<pre>要素
                        let prevPre = pre.previousElementSibling;
                        while (prevPre && prevPre.tagName !== 'PRE') {
                            prevPre = prevPre.previousElementSibling;
                        }
                        
                        // さらに慎重にチェック：カーソルがこのpre要素内にないことを確認
                        const selection = window.getSelection();
                        if (selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            if (pre.contains(range.commonAncestorContainer)) {
                                console.log('Skipping pre element because cursor is inside it');
                                return; // カーソルがこのpre要素内にある場合は削除しない
                            }
                        }
                        
                        if (prevPre) {
                            const prevCode = prevPre.querySelector('code');
                            if (prevCode && 
                                prevCode.parentElement === prevPre &&
                                !prevCode.classList.contains('no-highlight')) {
                                
                                console.log('Merging split pre element');
                                // 前のコードブロックに改行を追加
                                const textNodes = [];
                                const walker = document.createTreeWalker(
                                    prevCode,
                                    NodeFilter.SHOW_TEXT,
                                    null
                                );
                                let node;
                                while (node = walker.nextNode()) {
                                    textNodes.push(node);
                                }
                                
                                if (textNodes.length > 0) {
                                    const lastTextNode = textNodes[textNodes.length - 1];
                                    lastTextNode.textContent += '\n';
                                    
                                    // カーソル位置を修正
                                    if (selection.rangeCount > 0) {
                                        const newRange = document.createRange();
                                        newRange.setStart(lastTextNode, lastTextNode.textContent.length);
                                        newRange.collapse(true);
                                        selection.removeAllRanges();
                                        selection.addRange(newRange);
                                    }
                                } else {
                                    const textNode = document.createTextNode('\n');
                                    prevCode.appendChild(textNode);
                                    
                                    // カーソル位置を修正
                                    if (selection.rangeCount > 0) {
                                        const newRange = document.createRange();
                                        newRange.setStart(textNode, 1);
                                        newRange.collapse(true);
                                        selection.removeAllRanges();
                                        selection.addRange(newRange);
                                    }
                                }
                                
                                console.log('Removing split pre element');
                                pre.remove();
                            } else {
                                console.log('Previous pre does not have valid code, skipping removal');
                            }
                        } else {
                            // 前のpre要素がない場合も、カーソルがこのpre要素内にある場合は削除しない
                            if (selection.rangeCount > 0) {
                                const range = selection.getRangeAt(0);
                                if (pre.contains(range.commonAncestorContainer)) {
                                    console.log('Skipping pre element removal because cursor is inside');
                                    return;
                                }
                            }
                            console.log('Removing orphaned pre element');
                            pre.remove();
                        }
                    }
                });

                if (hadChanges) {
                    // カーソル位置を修正（現在のコードブロック内）
                    const allTextNodes = [];
                    const walker = document.createTreeWalker(
                        currentCodeElement,
                        NodeFilter.SHOW_TEXT,
                        null
                    );
                    let node;
                    while (node = walker.nextNode()) {
                        allTextNodes.push(node);
                    }
                    
                    if (allTextNodes.length > 0) {
                        const lastNode = allTextNodes[allTextNodes.length - 1];
                        const selection = window.getSelection();
                        if (selection.rangeCount > 0) {
                            const newRange = document.createRange();
                            newRange.setStart(lastNode, lastNode.textContent.length);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    }
                }
                
                // ハイライトを再適用
                clearTimeout(inputTimeout);
                inputTimeout = setTimeout(() => {
                    highlightCodeBlock(currentCodeElement, true);
                    isProcessingInput = false;
                }, 100);
            });
        } else {
            // 通常の入力処理
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                highlightCodeBlocks();
            }, 500);
        }
    });
    
    // MutationObserverでDOMの変更を監視（<br>タグの挿入や<pre>要素の分割を即座に検出）
    const observer = new MutationObserver((mutations) => {
        console.log('MutationObserver: mutations detected', mutations.length);
        
        if (isProcessingInput) {
            console.log('MutationObserver: isProcessingInput is true, skipping');
            return;
        }
        
        // コードブロック挿入中は処理しない
        if (editor._syntaxHighlightSetup && editor._syntaxHighlightSetup.isInsertingCodeBlock) {
            console.log('MutationObserver: code block insertion in progress, skipping');
            return;
        }
        
        // ハイライト適用中は処理しない（DOM変更が発生するため）
        if (editor._syntaxHighlightSetup && editor._syntaxHighlightSetup.isHighlighting) {
            console.log('MutationObserver: Skipping because highlighting is in progress');
            return;
        }
        
        // カーソルがコードブロック内にある場合は、ハイライト再適用をスキップ
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const currentCodeElement = isInCodeBlock(range);
            if (currentCodeElement) {
                console.log('MutationObserver: Cursor is in code block, skipping highlight reapplication');
                // shouldHighlightはfalseのままにする（コードブロック内でのハイライト再適用を防ぐ）
            }
        }
        
        let shouldHighlight = false;
        let shouldCleanup = false;
        let affectedCodeElement = null;
        let splitPreElements = [];
        
        mutations.forEach((mutation) => {
            // DOM変更がハイライト適用によるものかどうかをチェック
            // code要素のクラス変更や子要素の追加はハイライト適用による可能性が高い
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.tagName === 'CODE' && (target.classList.contains('hljs') || target.hasAttribute('data-highlighted'))) {
                    // ハイライト適用によるクラス変更の場合はスキップ
                    console.log('MutationObserver: Skipping highlight-related class change');
                    return;
                }
            }
            
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 追加されたノードがspan要素で、親がcode要素の場合はハイライト適用による可能性が高い
                const hasHighlightSpans = Array.from(mutation.addedNodes).some(node => 
                    node.nodeType === Node.ELEMENT_NODE && 
                    node.tagName === 'SPAN' && 
                    node.parentElement && 
                    node.parentElement.tagName === 'CODE'
                );
                if (hasHighlightSpans) {
                    // ハイライト適用による変更の場合はスキップ
                    console.log('MutationObserver: Skipping highlight-related span addition');
                    return;
                }
            }
            
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 新しい<pre>要素が追加された場合（分割された可能性）
                        if (node.tagName === 'PRE') {
                            // エディタ直下の<pre>要素をチェック（分割された可能性）
                            if (node.parentElement === editorEl) {
                                const code = node.querySelector('code');
                                
                                // 正常なコードブロック（code要素がpreの直接の子要素）は絶対に削除しない
                                if (code && code.parentElement === node && !code.classList.contains('no-highlight')) {
                                    console.log('MutationObserver: Valid code block detected, skipping removal');
                                    shouldHighlight = true;
                                    return; // このノードの処理をスキップ
                                }
                                
                                // code要素がない、またはcode要素がpreの直接の子要素でない場合
                                // ただし、カーソルがこのpre要素内にある場合は絶対に削除しない
                                const selection = window.getSelection();
                                if (selection.rangeCount > 0) {
                                    const range = selection.getRangeAt(0);
                                    if (node.contains(range.commonAncestorContainer)) {
                                        console.log('MutationObserver: Skipping pre element because cursor is inside');
                                        shouldHighlight = true;
                                        return; // このノードの処理をスキップ
                                    }
                                }
                                
                                // code要素が存在する場合は削除しない（ハイライト適用後のDOM構造変化の可能性がある）
                                if (code && code.parentElement === node) {
                                    console.log('MutationObserver: Code element exists as direct child, skipping removal (might be valid)');
                                    shouldHighlight = true;
                                    return; // このノードの処理をスキップ
                                }
                                
                                // code要素が完全に存在せず、空または<br>のみの場合のみ分割された可能性を考慮
                                // ただし、他の条件もチェック
                                const innerHTML = node.innerHTML.trim();
                                const hasOnlyBr = innerHTML === '<br>' || innerHTML === '';
                                if (hasOnlyBr) {
                                    // 本当に分割された可能性がある場合のみ追加
                                    // 前の要素がpre要素でない場合は、新しいコードブロックの可能性があるため削除しない
                                    const prevSibling = node.previousElementSibling;
                                    if (prevSibling && prevSibling.tagName === 'PRE') {
                                        // 前のpre要素に正常なcode要素がある場合は、分割された可能性がある
                                        const prevCode = prevSibling.querySelector('code');
                                        if (prevCode && prevCode.parentElement === prevSibling && !prevCode.classList.contains('no-highlight')) {
                                            console.log('MutationObserver: Potentially split pre element detected');
                                            splitPreElements.push(node);
                                        } else {
                                            console.log('MutationObserver: Previous pre does not have valid code, might be new code block');
                                            shouldHighlight = true;
                                        }
                                    } else {
                                        console.log('MutationObserver: Empty pre but no previous pre, might be new code block');
                                        shouldHighlight = true;
                                    }
                                } else {
                                    console.log('MutationObserver: Pre element has content, skipping removal');
                                    shouldHighlight = true;
                                }
                            }
                        }
                        
                        // <br>タグが追加された場合
                        if (node.tagName === 'BR') {
                            const codeElement = node.closest('code');
                            if (codeElement && 
                                codeElement.parentElement && 
                                codeElement.parentElement.tagName === 'PRE' &&
                                !codeElement.classList.contains('no-highlight')) {
                                shouldCleanup = true;
                                affectedCodeElement = codeElement;
                            }
                        }
                        
                        // 追加された要素がcodeの場合
                        if (node.tagName === 'CODE') {
                            shouldHighlight = true;
                        }
                        // 追加された要素の中にpre codeが含まれている場合
                        if (node.querySelector && node.querySelector('pre code')) {
                            shouldHighlight = true;
                        }
                    }
                });
            }
        });
        
        // 分割された<pre>要素を修復
        if (splitPreElements.length > 0) {
            console.log('MutationObserver: Processing splitPreElements', splitPreElements.length);
            // さらに遅延を追加して、ハイライト適用が完全に終わるまで待つ
            setTimeout(() => {
                requestAnimationFrame(() => {
                    // 再度、ハイライト適用中でないことを確認
                    if (editor._syntaxHighlightSetup && editor._syntaxHighlightSetup.isHighlighting) {
                        console.log('MutationObserver: Still highlighting, skipping split pre cleanup');
                        return;
                    }

                    const selection = window.getSelection();
                    let currentCodeElement = null;
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        currentCodeElement = isInCodeBlock(range);
                    }
                    
                    splitPreElements.forEach((splitPre) => {
                        console.log('MutationObserver: Processing splitPre element:', splitPre, 'Code:', splitPre.querySelector('code'));
                        
                        // コードブロックが既に削除されている場合はスキップ
                        if (!splitPre.parentElement || !editorEl.contains(splitPre)) {
                            console.log('MutationObserver: Split pre already removed, skipping');
                            return;
                        }
                        
                        // 削除前に、このpre要素が本当に削除対象か再確認
                        const code = splitPre.querySelector('code');
                        
                        // code要素が存在し、preの直接の子要素である場合は削除しない
                        if (code && code.parentElement === splitPre && !code.classList.contains('no-highlight')) {
                            console.log('MutationObserver: Split pre has valid code, skipping removal');
                            return;
                        }
                        
                        // 正常なコードブロック（code要素がpreの直接の子要素で、no-highlightクラスがない）をさらにチェック
                        if (code && code.parentElement === splitPre) {
                            console.log('MutationObserver: Split pre has code as direct child, skipping removal (even if no-highlight)');
                            return;
                        }
                        
                        // 現在編集中のコードブロックと一致する場合は絶対に削除しない
                        if (currentCodeElement) {
                            const currentPre = currentCodeElement.parentElement;
                            if (splitPre === currentPre) {
                                console.log('MutationObserver: Split pre is current editing block, skipping removal');
                                return;
                            }
                            // さらに、code要素が現在編集中のcode要素と一致する場合も削除しない
                            if (code === currentCodeElement) {
                                console.log('MutationObserver: Split pre contains current code element, skipping removal');
                                return;
                            }
                        }
                        
                        // カーソルがこのpre要素内にある場合は削除しない
                        if (selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            if (splitPre.contains(range.commonAncestorContainer)) {
                                console.log('MutationObserver: Skipping pre element because cursor is inside');
                                return;
                            }
                        }
                        
                        // 前の<pre>要素を探す
                        let prevPre = splitPre.previousElementSibling;
                        while (prevPre && prevPre.tagName !== 'PRE') {
                            prevPre = prevPre.previousElementSibling;
                        }
                        
                        if (prevPre) {
                            const prevCode = prevPre.querySelector('code');
                            if (prevCode && 
                                prevCode.parentElement === prevPre &&
                                !prevCode.classList.contains('no-highlight')) {
                                
                                console.log('MutationObserver: Merging split pre element - BEFORE REMOVAL');
                                console.log('MutationObserver: About to remove:', splitPre);
                                console.log('MutationObserver: Pre element has content?', splitPre.textContent || splitPre.innerHTML);
                                
                                // 前のコードブロックに改行を追加
                                const textNodes = [];
                                const walker = document.createTreeWalker(
                                    prevCode,
                                    NodeFilter.SHOW_TEXT,
                                    null
                                );
                                let node;
                                while (node = walker.nextNode()) {
                                    textNodes.push(node);
                                }
                                
                                if (textNodes.length > 0) {
                                    const lastTextNode = textNodes[textNodes.length - 1];
                                    lastTextNode.textContent += '\n';
                                    
                                    // カーソル位置を修正
                                    if (selection.rangeCount > 0) {
                                        const newRange = document.createRange();
                                        newRange.setStart(lastTextNode, lastTextNode.textContent.length);
                                        newRange.collapse(true);
                                        selection.removeAllRanges();
                                        selection.addRange(newRange);
                                    }
                                } else {
                                    // テキストノードがない場合は作成
                                    const textNode = document.createTextNode('\n');
                                    prevCode.appendChild(textNode);
                                    
                                    // カーソル位置を修正
                                    if (selection.rangeCount > 0) {
                                        const newRange = document.createRange();
                                        newRange.setStart(textNode, 1);
                                        newRange.collapse(true);
                                        selection.removeAllRanges();
                                        selection.addRange(newRange);
                                    }
                                }
                                
                                // 分割された<pre>要素を削除
                                console.log('MutationObserver: Removing split pre element');
                                splitPre.remove();
                                
                                // ハイライトを再適用
                                setTimeout(() => {
                                    highlightCodeBlock(prevCode);
                                }, 50);
                                
                                return;
                            } else {
                                // 前のpre要素に正常なcode要素がない場合は、削除しない
                                console.log('MutationObserver: Previous pre does not have valid code, skipping removal');
                                return;
                            }
                        } else {
                            // 前の<pre>要素が見つからない場合でも、正常なコードブロックの可能性があるため削除しない
                            // 本当に不要な要素のみ削除する（空の<br>のみなど）
                            console.log('MutationObserver: No previous pre found, checking if should remove');
                            console.log('MutationObserver: SplitPre innerHTML:', splitPre.innerHTML);
                            console.log('MutationObserver: SplitPre textContent:', splitPre.textContent);
                            if (splitPre.innerHTML.trim() === '<br>' || splitPre.innerHTML.trim() === '') {
                                console.log('MutationObserver: Removing orphaned empty pre element');
                                splitPre.remove();
                            } else {
                                console.log('MutationObserver: Orphaned pre has content, keeping it');
                            }
                        }
                    });
                });
            }, 600); // setTimeoutの遅延時間を追加（ハイライト適用完了を待つ）
        }
        
        if (shouldCleanup && affectedCodeElement) {
            // コードブロック内の不要な要素を即座に削除
            requestAnimationFrame(() => {
                cleanupBrTags(affectedCodeElement);
                
                // 不要なpre要素を削除
                const nestedPre = affectedCodeElement.querySelector('pre');
                if (nestedPre) {
                    const text = nestedPre.textContent;
                    const textNode = document.createTextNode(text);
                    nestedPre.parentNode.replaceChild(textNode, nestedPre);
                }
            });
        }
        
        // コードブロック内にカーソルがない場合のみハイライトを再適用
        if (shouldHighlight && splitPreElements.length === 0) {
            const selection = window.getSelection();
            let shouldApplyHighlight = true;
            
            // カーソルがコードブロック内にある場合はハイライトを適用しない
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const currentCodeElement = isInCodeBlock(range);
                if (currentCodeElement) {
                    console.log('MutationObserver: Skipping highlight reapplication because cursor is in code block');
                    shouldApplyHighlight = false;
                }
            }
            
            if (shouldApplyHighlight) {
                setTimeout(() => {
                    highlightCodeBlocks();
                }, 200);
            }
        }
    });
    
    // エディタ全体を監視
    observer.observe(editorEl, {
        childList: true,
        subtree: true
    });
    
    // 初期ハイライト（highlight.jsの読み込みを待つ）
    function initHighlight() {
        const hljs = getHljs();
        if (hljs && hljs.highlightElement) {
            console.log('highlight.js is ready, applying syntax highlight');
            setTimeout(() => {
                highlightCodeBlocks();
            }, 500);
        } else {
            // highlight.jsがまだ読み込まれていない場合は再試行（最大50回 = 5秒間）
            if (!window._hljsRetryCount) {
                window._hljsRetryCount = 0;
            }
            if (window._hljsRetryCount < 50) {
                window._hljsRetryCount++;
                setTimeout(initHighlight, 100);
            } else {
                console.error('highlight.js failed to load after 5 seconds');
            }
        }
    }
    
    initHighlight();
    
    // コードブロックから抜けたときにハイライトを適用
    let lastHighlightedCodeBlock = null;
    let codeBlockExitTimeout = null;
    
    function handleCodeBlockExit() {
        // 最後に編集中だったコードブロックを取得
        if (editor._syntaxHighlightSetup && editor._syntaxHighlightSetup.lastEditedCodeBlock) {
            const codeElement = editor._syntaxHighlightSetup.lastEditedCodeBlock;
            
            // コードブロックがまだ存在し、未ハイライトの場合のみ適用
            if (codeElement && codeElement.parentElement && 
                codeElement.parentElement.tagName === 'PRE' && 
                editorEl.contains(codeElement.parentElement)) {
                
                // すでにハイライト済みかチェック（DOM構造も確認）
                // hljsクラスだけでなく、実際のハイライトDOM構造（spanタグなど）が存在するかチェック
                const hasHighlightStructure = codeElement.querySelector('span.hljs-string, span.hljs-keyword, span.hljs-function, span.hljs-number, span.hljs-comment, span.hljs-variable, span.hljs-operator') !== null;
                const isAlreadyHighlighted = codeElement.classList.contains('hljs') && hasHighlightStructure;
                
                if (codeElement === lastHighlightedCodeBlock && isAlreadyHighlighted) {
                    // 既にハイライト済みで、DOM構造も存在する場合はスキップ
                    return;
                }
                
                const textContent = codeElement.textContent || codeElement.innerText;
                if (textContent && textContent.trim()) {
                    // ハイライトを再適用（force=trueで強制的に再適用）
                    highlightCodeBlock(codeElement, true);
                    lastHighlightedCodeBlock = codeElement;
                }
            }
            
            // 記録をクリア
            editor._syntaxHighlightSetup.lastEditedCodeBlock = null;
        }
    }
    
    // カーソル位置の変更を監視して、コードブロックから抜けたときにハイライトを適用
    document.addEventListener('selectionchange', () => {
        // デバウンス：短い遅延を入れて、連続したselectionchangeイベントを1回だけ処理
        clearTimeout(codeBlockExitTimeout);
        codeBlockExitTimeout = setTimeout(() => {
            const selection = window.getSelection();
            if (!selection.rangeCount) {
                // 選択範囲がない場合（エディタからフォーカスが外れた場合など）
                handleCodeBlockExit();
                return;
            }
            
            const range = selection.getRangeAt(0);
            const codeElement = isInCodeBlock(range);
            
            // カーソルがコードブロック外にある場合のみハイライトを適用
            if (!codeElement) {
                handleCodeBlockExit();
            }
        }, 100);
    });
    
    // エディタからフォーカスが外れたときもハイライトを適用
    editorEl.addEventListener('blur', () => {
        handleCodeBlockExit();
    }, true);
    
    // setContentが呼ばれた後にハイライトを適用するためのフック
    const originalSetContent = editor.setContent;
    if (originalSetContent) {
        editor.setContent = function(html) {
            const result = originalSetContent.call(this, html);
            // コンテンツ設定後にハイライトを適用
            setTimeout(() => {
                const hljs = getHljs();
                if (hljs && hljs.highlightElement) {
                    highlightCodeBlocks();
                }
            }, 300);
            return result;
        };
    }
    
    // 公開関数（外部から呼び出し可能）
    editor.highlightCodeBlocks = highlightCodeBlocks;
    editor.highlightCodeBlock = highlightCodeBlock;
}

// コードブロックを挿入（ツールバーから呼び出される）
export function insertCodeBlock(editor, language = '', noHighlight = false) {
    console.log('insertCodeBlock called');
    
    // エディタ要素を取得
    const editorEl = editor.editor;
    
    if (!editorEl) {
        console.error('Editor element not found');
        return;
    }
    
    // コードブロック挿入中フラグを設定（最初に設定）
    if (!editor._syntaxHighlightSetup) {
        editor._syntaxHighlightSetup = {};
    }
    editor._syntaxHighlightSetup.isInsertingCodeBlock = true;
    
    // 履歴保存（変更前の状態を保存）
    if (editor.saveStateToHistory) {
        editor.saveStateToHistory();
    }
    
    // エディタにフォーカス
    editorEl.focus();
    
    // requestAnimationFrameを使って、ブラウザのレンダリングサイクルに合わせて実行
    requestAnimationFrame(() => {
        const selection = window.getSelection();
        let range = null;
        
        // 選択範囲を取得
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
            
            // 選択範囲がエディタ外の場合は無効化
            if (!editorEl.contains(range.commonAncestorContainer)) {
                console.log('Range is outside editor, creating new range');
                range = null;
            }
        }
        
        // エディタが空の場合、または選択範囲がない場合
        if (!range || editorEl.childNodes.length === 0) {
            console.log('Editor is empty or no range, creating default range');
            range = document.createRange();
            // エディタに空の<p>要素があることを確認（contentEditableの標準的な動作）
            if (editorEl.childNodes.length === 0) {
                // 空の<p>要素を作成してカーソルを配置
                const p = document.createElement('p');
                const br = document.createElement('br');
                p.appendChild(br);
                editorEl.appendChild(p);
                
                // カーソルを<p>要素内に配置
                range.setStart(p, 0);
                range.collapse(true);
            } else {
                // 最後のノードの後にカーソルを配置
                const lastNode = editorEl.childNodes[editorEl.childNodes.length - 1];
                if (lastNode.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastNode, lastNode.length);
                } else {
                    range.setStartAfter(lastNode);
                }
                range.collapse(true);
            }
            
            // 選択範囲を設定
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // コードブロック要素を作成
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        
        // ハイライトなしの場合
        if (noHighlight) {
            code.className = 'no-highlight';
        } else {
            // 言語クラスを設定（highlight.jsが自動検出できるように）
            if (language) {
                code.className = `language-${language}`;
            } else {
                // デフォルトでは言語クラスなし（highlight.jsが自動検出）
                // クラスを設定しない（空文字列ではなく、プロパティ自体を設定しない）
                // これにより、highlight.jsが自動検出を試みる
                // ただし、自動検出が失敗する可能性があるため、デフォルト言語として'text'を設定
                code.className = 'language-text'; // デフォルト言語として'text'を設定
            }
        }
        
        // 初期テキストを設定（空にする）
        const textNode = document.createTextNode('');
        code.appendChild(textNode);
        pre.appendChild(code);
        
        try {
            console.log('Attempting to insert code block at:', range.startContainer, range.startOffset);
            
            // 選択されたテキストを削除
            if (!range.collapsed) {
                range.deleteContents();
                // 削除後にrangeを再取得
                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);
                }
            }
            
            // カーソル位置からエディタ直下のブロック要素を見つける
            let currentNode = range.startContainer;
            let blockElement = null;
            
            // テキストノードの場合は親要素から開始
            if (currentNode.nodeType === Node.TEXT_NODE) {
                currentNode = currentNode.parentElement;
            }
            
            // エディタ直下のブロック要素まで遡る
            while (currentNode && currentNode !== editorEl) {
                if (currentNode.parentElement === editorEl) {
                    blockElement = currentNode;
                    break;
                }
                currentNode = currentNode.parentElement;
            }
            
            // ブロック要素が見つかった場合
            if (blockElement) {
                // カーソル位置がブロック要素の先頭にあるかチェック
                let isAtStart = false;
                const rangeClone = range.cloneRange();
                
                if (range.startContainer.nodeType === Node.TEXT_NODE) {
                    // テキストノード内の場合
                    const textNode = range.startContainer;
                    const textParent = textNode.parentElement;
                    
                    // ブロック要素の最初のテキストノードかチェック
                    if (textParent === blockElement || blockElement.contains(textParent)) {
                        // ブロック要素内の最初のテキストノードで、かつカーソルが先頭にある場合
                        const firstTextNode = blockElement.querySelector('*') || blockElement;
                        const walker = document.createTreeWalker(
                            blockElement,
                            NodeFilter.SHOW_TEXT,
                            null
                        );
                        const firstText = walker.nextNode();
                        if (firstText === textNode && range.startOffset === 0) {
                            isAtStart = true;
                        }
                    }
                } else if (range.startContainer === blockElement && range.startOffset === 0) {
                    isAtStart = true;
                }
                
                // カーソルがブロック要素の先頭にある場合は、その前に挿入
                if (isAtStart) {
                    editorEl.insertBefore(pre, blockElement);
                } else {
                    // それ以外は、ブロック要素の後に挿入
                    if (blockElement.nextSibling) {
                        editorEl.insertBefore(pre, blockElement.nextSibling);
                    } else {
                        editorEl.appendChild(pre);
                    }
                }
            } else {
                // ブロック要素が見つからない場合（エディタが空など）
                // カーソル位置を基準に、エディタ内のすべての子要素を確認
                const allChildren = Array.from(editorEl.children);
                
                if (allChildren.length === 0) {
                    // エディタが空の場合は最後に追加
                    editorEl.appendChild(pre);
                } else {
                    // カーソル位置に最も近いブロック要素を探す
                    let insertIndex = -1;
                    
                    for (let i = 0; i < allChildren.length; i++) {
                        const child = allChildren[i];
                        const childRange = document.createRange();
                        childRange.selectNodeContents(child);
                        
                        // カーソルがこの要素の前にあれば、この要素の前に挿入
                        if (range.compareBoundaryPoints(Range.START_TO_START, childRange) < 0) {
                            insertIndex = i;
                            break;
                        }
                    }
                    
                    if (insertIndex >= 0) {
                        editorEl.insertBefore(pre, allChildren[insertIndex]);
                    } else {
                        // すべての要素の後にある場合は最後に追加
                        editorEl.appendChild(pre);
                    }
                }
            }
            
            console.log('Code block inserted, DOM:', editorEl.innerHTML);
            
            // カーソルをコードブロック内に移動（改行の後に配置）
            // コードブロック挿入後に、code要素内のテキストノードを再取得
            const codeElementInDOM = pre.querySelector('code');
            if (codeElementInDOM) {
                const textNodesInCode = [];
                const walker = document.createTreeWalker(
                    codeElementInDOM,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let node;
                while (node = walker.nextNode()) {
                    textNodesInCode.push(node);
                }
                
                const targetTextNode = textNodesInCode.length > 0 ? textNodesInCode[0] : null;
                if (targetTextNode && targetTextNode.textContent.length >= 1) {
                    // テキストがある場合は先頭にカーソルを配置
                    const newRange = document.createRange();
                    newRange.setStart(targetTextNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } else if (targetTextNode) {
                    // テキストノードが存在するが長さが0の場合は、先頭にカーソルを配置
                    const newRange = document.createRange();
                    newRange.setStart(targetTextNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                } else {
                    // テキストノードがない場合は作成（空文字列で）
                    const newTextNode = document.createTextNode('');
                    codeElementInDOM.appendChild(newTextNode);
                    const newRange = document.createRange();
                    newRange.setStart(newTextNode, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
            
            editor.updatePlaceholder();
            
            // 変更後の状態を履歴に保存
            if (editor.saveStateToHistory) {
                editor.saveStateToHistory();
            }
            
            // ハイライトを適用（no-highlightの場合はスキップ）
            const getHljs = () => {
                if (typeof window !== 'undefined' && window.hljs) {
                    return window.hljs;
                }
                if (typeof hljs !== 'undefined') {
                    return hljs;
                }
                return null;
            };
            
            // フラグを解除（少し遅延させて、他のイベントハンドラが実行される前に確実に処理されるようにする）
            setTimeout(() => {
                if (!noHighlight) {
                    const hljs = getHljs();
                    if (hljs && hljs.highlightElement && editor.highlightCodeBlock) {
                        editor.highlightCodeBlock(code);
                    }
                }
                // フラグを解除
                if (editor._syntaxHighlightSetup) {
                    editor._syntaxHighlightSetup.isInsertingCodeBlock = false;
                }
                console.log('Code block insertion flag cleared');
            }, 300); // 300ms待ってからフラグを解除
            
        } catch (error) {
            console.error('Error inserting code block:', error);
            // エラーが発生した場合でも、エディタの最後に追加を試みる
            try {
                editorEl.appendChild(pre);
                const newRange = document.createRange();
                newRange.setStart(textNode, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                editor.updatePlaceholder();
            } catch (e) {
                console.error('Failed to insert code block:', e);
            }
            // フラグを解除
            if (editor._syntaxHighlightSetup) {
                editor._syntaxHighlightSetup.isInsertingCodeBlock = false;
            }
        }
    });
}