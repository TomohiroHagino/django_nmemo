import { BLOCK_ELEMENTS } from './toolbar.js';

// アコーディオン機能（Notion風）
export function setupAccordion(editor) {
    const editorEl = editor.editor;
    let isProcessing = false;

    // beforeinputイベントで入力前に処理（captureフェーズで先に処理）
    editorEl.addEventListener('beforeinput', (e) => {
        if (isProcessing) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const blockElement = getBlockElement(range);
        if (!blockElement) return;

        // コードブロック内やアコーディオン内は処理しない
        if (blockElement.tagName === 'PRE' || blockElement.closest('pre') || 
            blockElement.closest('.accordion-item')) {
            return;
        }

        const text = blockElement.textContent || '';

        // Enterキーが押された場合
        if (e.inputType === 'insertLineBreak') {
            // アコーディオンの処理（> + スペース + テキスト）
            if (text.match(/^>\s+.*/)) {
                e.preventDefault();
                e.stopPropagation(); // 他のイベントリスナーに伝播させない
                isProcessing = true;
                setTimeout(() => {
                    convertToAccordion(blockElement, text);
                    isProcessing = false;
                }, 0);
                return;
            }
        }

        // スペースが入力された場合
        if (e.data === ' ') {
            // アコーディオンの処理（> + スペース）
            if (text.match(/^>$/)) {
                // スペースは後で追加されるので、アコーディオン変換は次のinputで
                return;
            }
        }
    }, true); // captureフェーズで登録

    // inputイベントで処理（スペース入力後など）
    editorEl.addEventListener('input', (e) => {
        if (isProcessing) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const blockElement = getBlockElement(range);
        if (!blockElement) return;

        // コードブロック内やアコーディオン内は処理しない
        if (blockElement.tagName === 'PRE' || blockElement.closest('pre') ||
            blockElement.closest('.accordion-item')) {
            return;
        }

        const text = blockElement.textContent || '';

        // アコーディオンの処理（> + スペース + テキスト）
        if (text.match(/^>\s+.+/) && e.inputType === 'insertText' && e.data === ' ') {
            setTimeout(() => {
                if (!isProcessing) {
                    isProcessing = true;
                    convertToAccordion(blockElement, blockElement.textContent);
                    isProcessing = false;
                }
            }, 10);
        }
    }, true); // captureフェーズで登録

    // アコーディオンのクリックイベント（開閉）
    editorEl.addEventListener('click', (e) => {
        const accordionHeader = e.target.closest('.accordion-header');
        if (accordionHeader) {
            e.preventDefault();
            e.stopPropagation();
            toggleAccordion(accordionHeader);
            return;
        }

        // アコーディオンのタイトルをクリックした場合
        const accordionTitle = e.target.closest('.accordion-title');
        if (accordionTitle) {
            // タイトル内のクリックは編集可能にする
            return;
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
        if (BLOCK_ELEMENTS.includes(node.tagName)) {
            return node;
        }
        node = node.parentElement;
    }

    // 見つからない場合は、範囲を囲む要素を返す
    return node && node.tagName !== 'BODY' ? node : null;
}

function convertToAccordion(blockElement, text) {
    const match = text.match(/^>\s+(.*)/);
    if (!match) return;

    const title = match[1] || '';

    // 履歴に保存（エディタにsaveStateToHistoryメソッドがある場合）
    const editor = blockElement.closest('.custom-editor');
    if (editor && editor._editorInstance && editor._editorInstance.saveStateToHistory) {
        editor._editorInstance.saveStateToHistory();
    }

    // アコーディオン要素を作成
    const accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';

    const accordionHeader = document.createElement('div');
    accordionHeader.className = 'accordion-header';
    accordionHeader.setAttribute('contenteditable', 'false');

    const accordionIcon = document.createElement('span');
    accordionIcon.className = 'accordion-icon';
    accordionIcon.textContent = '▶';

    const accordionTitle = document.createElement('span');
    accordionTitle.className = 'accordion-title';
    accordionTitle.textContent = title;
    accordionTitle.setAttribute('contenteditable', 'true');

    accordionHeader.appendChild(accordionIcon);
    accordionHeader.appendChild(accordionTitle);

    const accordionContent = document.createElement('div');
    accordionContent.className = 'accordion-content';
    accordionContent.style.display = 'none';

    const accordionBody = document.createElement('div');
    accordionBody.className = 'accordion-body';
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    accordionBody.appendChild(p);
    accordionBody.setAttribute('contenteditable', 'true');

    accordionContent.appendChild(accordionBody);
    accordionItem.appendChild(accordionHeader);
    accordionItem.appendChild(accordionContent);

    // ブロック要素をアコーディオンに置き換え
    blockElement.parentElement.replaceChild(accordionItem, blockElement);

    // カーソルをアコーディオンの本文に移動
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // アコーディオンのタイトル編集時の処理
    accordionTitle.addEventListener('blur', () => {
        if (accordionTitle.textContent.trim() === '') {
            // タイトルが空の場合はアコーディオンを削除して通常の段落に戻す
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            accordionItem.parentElement.replaceChild(newP, accordionItem);
            const newRange = document.createRange();
            newRange.setStart(newP, 0);
            newRange.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    });

    // アコーディオンの本文でEnterキーを押したときの処理
    accordionBody.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const blockElement = getBlockElement(range);
            if (!blockElement) return;

            // 空の段落の場合は新しい段落を作成
            if (blockElement.textContent.trim() === '' && blockElement.tagName === 'P') {
                e.preventDefault();
                const newP = document.createElement('p');
                newP.innerHTML = '<br>';
                blockElement.parentElement.insertBefore(newP, blockElement.nextSibling);
                const newRange = document.createRange();
                newRange.setStart(newP, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    });
}

function toggleAccordion(header) {
    const accordionItem = header.closest('.accordion-item');
    if (!accordionItem) return;

    const content = accordionItem.querySelector('.accordion-content');
    const icon = header.querySelector('.accordion-icon');

    if (!content || !icon) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
        accordionItem.classList.add('expanded');
    } else {
        content.style.display = 'none';
        icon.textContent = '▶';
        accordionItem.classList.remove('expanded');
    }
}
