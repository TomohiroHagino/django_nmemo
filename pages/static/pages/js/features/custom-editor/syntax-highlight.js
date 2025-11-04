import { SyntaxHighlighter } from './syntax-highlight/index.js';

// 後方互換性のためのエクスポート関数
export function setupSyntaxHighlight(editor) {
    const highlighter = new SyntaxHighlighter(editor);
    highlighter.setup();
    editor._syntaxHighlighter = highlighter;
    return highlighter;
}

export function insertCodeBlock(editor, language = '', noHighlight = false) {
    if (editor._syntaxHighlighter) {
        editor._syntaxHighlighter.insertCodeBlock(language, noHighlight);
    } else {
        console.warn('SyntaxHighlighter not initialized. Call setupSyntaxHighlight first.');
    }
}

export { SyntaxHighlighter };