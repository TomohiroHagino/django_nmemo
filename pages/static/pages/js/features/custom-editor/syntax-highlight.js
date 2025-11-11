import { SyntaxHighlighter } from './syntax-highlight/index.js';

const ERROR_MESSAGE = 'SyntaxHighlighter が初期化されていません。まず setupSyntaxHighlight を呼び出してください。';

export function setupSyntaxHighlight(editor) {
    const highlighter = new SyntaxHighlighter(editor);
    highlighter.setup();
    // 注意: editor オブジェクトに _syntaxHighlighter プロパティを追加します
    // これは後続の insertCodeBlock 関数で使用されるため、意図的な副作用です
    editor._syntaxHighlighter = highlighter;
    return highlighter;
}

function _checkAndWarnIfNotInitialized(editor) {
    if (!editor._syntaxHighlighter) {
        console.warn(ERROR_MESSAGE);
        return false;
    }
    return true;
}

export function insertCodeBlock(editor, language = '') {
    if (!_checkAndWarnIfNotInitialized(editor)) {
        return;
    }
    editor._syntaxHighlighter.insertCodeBlock(language, true);
}

export function insertCodeBlockWithoutHighlight(editor, language = '') {
    if (!_checkAndWarnIfNotInitialized(editor)) {
        return;
    }
    editor._syntaxHighlighter.insertCodeBlock(language, false);
}

export { SyntaxHighlighter };