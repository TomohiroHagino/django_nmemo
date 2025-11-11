// スタイル付きコピペ処理（既存のclipboard-formatter.jsから改善）

// 定数定義
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_FILE_SIZE = 250 * 1024 * 1024; // 250MB
const TABLE_WIDTH_THRESHOLD_RATIO = 0.9; // テーブル幅の閾値（エディター幅の90%）
const SKIP_STYLE_ELEMENTS = ['BR', 'HR', 'WBR', 'INPUT', 'META', 'LINK', 'BASE']; // スタイル処理をスキップする要素
const BASE_IMPORTANT_STYLE_PROPS = [
    'color', 'background-color', 'background',
    'font-size', 'font-weight', 'font-style', 'font-family',
    'text-decoration', 'text-align',
    'border', 'border-color', 'border-width', 'border-style',
    'padding', 'margin', 'vertical-align'
]; // コピー時に保持する重要なスタイルプロパティ（基本）
const TABLE_IMPORTANT_STYLE_PROPS = ['width', 'height', 'border-collapse', 'border-spacing']; // テーブル要素用の追加スタイルプロパティ

// スタイル値が有効かどうかを判定（無効なデフォルト値を除外）
function isValidStyleValue(value, includeAuto = true) {
    if (!value || !value.trim()) {
        return false;
    }
    
    const invalidValues = ['none', 'rgba(0, 0, 0, 0)', 'transparent', 'normal'];
    if (includeAuto) {
        invalidValues.push('auto');
    }
    
    return !invalidValues.includes(value) && 
           !value.startsWith('0px') && 
           value.trim().length > 0;
}

// 選択範囲がエディター内かどうかをチェック
function isSelectionInEditor(selection, editorElement) {
    if (!selection.rangeCount) {
        return false;
    }
    const range = selection.getRangeAt(0);
    return editorElement.contains(range.commonAncestorContainer);
}

// 選択範囲が画像のみかどうかを判定
function isImageOnlySelection(range, imagesInSelection) {
    if (imagesInSelection.length === 0) {
        return false;
    }
    
    const selectedNode = range.commonAncestorContainer;
    
    // 画像要素自体が選択範囲の共通祖先である場合
    if (selectedNode.nodeType === Node.ELEMENT_NODE && selectedNode.tagName === 'IMG') {
        return true;
    }
    
    // 選択範囲内にテキストがあるかチェック
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(range.cloneContents());
    const textContent = tempContainer.textContent.trim();
    
    // 画像以外にコンテンツがない場合（テキストがなく、画像のみ）
    // ただし、複数の要素がある場合は通常のコピーにする
    return !textContent && imagesInSelection.length === 1 && tempContainer.children.length === 1;
}

// 画像のみの選択をクリップボードにコピー
function copyImageOnlySelection(img, clipboardData) {
    try {
        const imgClone = img.cloneNode(true);
        const html = imgClone.outerHTML;
        clipboardData.setData('text/html', html);
        clipboardData.setData('text/plain', img.src);

        copyImageToClipboard(img, clipboardData).catch(error => {
            console.warn('画像データのコピーに失敗しました（HTMLのみコピーされます）:', error);
        });
    } catch (error) {
        console.error('画像のコピー処理でエラー:', error);
        // エラー時はデフォルト動作に任せる
    }
}

// テキスト/混在コンテンツをクリップボードにコピー
function copyTextAndMixedContent(clonedContents, selection, editorElement, clipboardData) {
    try {
        const html = prepareHTMLForCopy(clonedContents, editorElement);
        const plainText = selection.toString();

        clipboardData.setData('text/html', html);
        clipboardData.setData('text/plain', plainText);
    } catch (error) {
        console.error('コピー処理でエラー:', error);
        clipboardData.setData('text/plain', selection.toString());
    }
}

// スタイルを保持するクリップボードの設定
export function setupStylePreservingClipboard(editor) {
    editor.editor.addEventListener('copy', function(copyEvent) {
        const selection = window.getSelection();
        
        if (!isSelectionInEditor(selection, editor.editor)) {
            return;
        }

        const range = selection.getRangeAt(0);
        const clonedContents = range.cloneContents();
        
        const tempContainer = document.createElement('div');
        tempContainer.appendChild(clonedContents.cloneNode(true));
        const imagesInSelection = tempContainer.querySelectorAll('img');
        
        const clipboardData = copyEvent.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        if (isImageOnlySelection(range, imagesInSelection) && imagesInSelection.length === 1) {
            copyEvent.preventDefault();
            copyEvent.stopPropagation();
            copyImageOnlySelection(imagesInSelection[0], clipboardData);
        } else {
            copyEvent.preventDefault();
            copyEvent.stopPropagation();
            copyTextAndMixedContent(clonedContents, selection, editor.editor, clipboardData);
        }
    }, true);
}

// 画像をクリップボードにコピーする関数
async function copyImageToClipboard(img, clipboardData) {
    try {
        // Canvas APIを使って画像をblobとして取得
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // 画像が読み込まれるまで待つ
        await new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous'; // CORS対応
            
            image.onload = () => {
                canvas.width = image.width;
                canvas.height = image.height;
                context.drawImage(image, 0, 0);
                resolve();
            };
            
            image.onerror = reject;
            image.src = img.src;
        });

        // Canvasからblobを取得
        canvas.toBlob((blob) => {
            if (blob && clipboardData instanceof ClipboardEvent) {
                // Clipboard APIを使用（モダンブラウザ）
                if (navigator.clipboard && navigator.clipboard.write) {
                    const clipboardItem = new ClipboardItem({ [blob.type]: blob });
                    navigator.clipboard.write([clipboardItem]).catch(error => {
                        console.warn('Clipboard APIでの画像コピーに失敗:', error);
                    });
                }
            }
        }, 'image/png');
    } catch (error) {
        // CORSエラーなどの場合はHTMLコピーのみで続行
        console.warn('画像データの取得に失敗:', error);
    }
}

// コピー用にHTMLを準備する関数（レイアウトを保持しつつ、フォーム内に収まるように調整）
function prepareHTMLForCopy(clonedContents, editorElement) {
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(clonedContents.cloneNode(true));
    
    // エディターの実際の幅を取得（制約を考慮）
    const editorRect = editorElement.getBoundingClientRect();
    const editorWidth = editorRect.width;
    
    // すべての要素を処理
    function processElementForCopy(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        const tagName = node.tagName ? node.tagName.toUpperCase() : '';
        
        // 画像の処理
        if (tagName === 'IMG') {
            const actualWidth = node.getBoundingClientRect().width;
            const actualHeight = node.getBoundingClientRect().height;
            
            // 元の幅がある場合は保持
            if (actualWidth > 0) {
                node.style.maxWidth = 'none';
                node.style.width = actualWidth + 'px';
                node.style.height = actualHeight + 'px';
            }
        }
        // テーブルの処理
        else if (tagName === 'TABLE') {
            const actualWidth = node.getBoundingClientRect().width;
            
            // テーブルがエディター幅を超えている場合は元の幅を保持
            if (actualWidth >= editorWidth * TABLE_WIDTH_THRESHOLD_RATIO) {
                // 元の幅を保持（コンテンツに応じた幅）
                node.style.maxWidth = 'none';
                node.style.width = 'auto';
                node.style.tableLayout = 'auto';
            } else {
                // 小さいテーブルは幅を保持
                node.style.width = actualWidth + 'px';
                node.style.maxWidth = 'none';
            }
        }
        // iframeの処理
        else if (tagName === 'IFRAME') {
            const actualWidth = node.getBoundingClientRect().width;
            const actualHeight = node.getBoundingClientRect().height;
            
            // 元のサイズを保持
            if (actualWidth > 0 && actualHeight > 0) {
                node.style.maxWidth = 'none';
                node.style.width = actualWidth + 'px';
                node.style.height = actualHeight + 'px';
            }
        }
        // div/p要素の処理
        else if (tagName === 'DIV' || tagName === 'P') {
            // max-width制約を解除して、コンテンツに応じた幅にする
            const computedStyle = window.getComputedStyle(node);
            const hasFixedWidth = node.style.width || computedStyle.width !== 'auto';
            
            if (!hasFixedWidth) {
                // 固定幅がない場合は、max-width制約のみ解除
                node.style.maxWidth = 'none';
            }
        }
        
        // スタイルをインライン化して保持
        inlineStylesForCopy(node);
        
        // 子要素を再帰的に処理
        Array.from(node.childNodes).forEach(child => {
            processElementForCopy(child);
        });
    }
    
    // ルート要素から処理
    Array.from(tempContainer.childNodes).forEach(child => {
        processElementForCopy(child);
    });
    
    return tempContainer.innerHTML;
}

// 要素のスタイルをインライン化してコピー用に準備
function inlineStylesForCopy(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    
    const tagName = node.tagName ? node.tagName.toUpperCase() : '';
    
    if (SKIP_STYLE_ELEMENTS.includes(tagName)) return;
    
    // classとidを削除（外部CSSに依存しないように）
    node.removeAttribute('class');
    node.removeAttribute('id');
    
    // 既存のインラインスタイルを取得
    const existingStyle = node.getAttribute('style') || '';
    const existingStyles = {};
    
    // 既存のスタイルをパース
    if (existingStyle) {
        existingStyle.split(';').forEach(style => {
            const [prop, value] = style.split(':').map(s => s.trim());
            if (prop && value) {
                existingStyles[prop] = value;
            }
        });
    }
    
    // 計算されたスタイルを取得して重要なものを追加
    try {
        const computedStyle = window.getComputedStyle(node);
        const importantProps = [...BASE_IMPORTANT_STYLE_PROPS, 'line-height'];
        
        if (tagName === 'TABLE' || tagName === 'TD' || tagName === 'TH' || tagName === 'TR') {
            importantProps.push(...TABLE_IMPORTANT_STYLE_PROPS, 'table-layout');
        }
        
        importantProps.forEach(prop => {
            // 既存スタイルがない場合のみ追加
            if (!existingStyles[prop]) {
                try {
                    const value = computedStyle.getPropertyValue(prop);
                    if (isValidStyleValue(value, true)) {
                        existingStyles[prop] = value;
                    }
                } catch (error) {
                    // 無視
                }
            }
        });
        
        // スタイルを文字列に変換
        const styleString = Object.entries(existingStyles)
            .map(([prop, value]) => `${prop}: ${value}`)
            .join('; ');
        
        if (styleString) {
            node.setAttribute('style', styleString);
        }
    } catch (error) {
        // エラー時は既存スタイルのみ保持
    }
}
