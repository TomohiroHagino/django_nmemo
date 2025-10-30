// サイドバーの幅をドラッグで変更（多重初期化防止・クリーンアップ対応）

const STORAGE_KEY = 'nmemo.sidebar.width';
const MIN_WIDTH_PX = 220;
const MAX_WIDTH_VW = 60;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function initSidebarResize() {
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebarResizer');
    if (!sidebar || !resizer) return;

    // 多重初期化防止
    if (resizer.dataset.resizeAttached === '1') return;
    resizer.dataset.resizeAttached = '1';

    // 初期幅の適用（保存されていれば）
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const w = parseInt(saved, 10);
            if (!Number.isNaN(w)) {
                sidebar.style.width = w + 'px';
            }
        }
    } catch (_) {}

    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e) => {
        if (!dragging) return;
        const delta = e.clientX - startX;
        let newWidth = startWidth + delta;
        const maxPx = Math.floor(window.innerWidth * (MAX_WIDTH_VW / 100));
        newWidth = clamp(newWidth, MIN_WIDTH_PX, maxPx);
        sidebar.style.width = newWidth + 'px';
    };

    const stopDragging = () => {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stopDragging);

        // 保存
        const widthPx = parseInt(getComputedStyle(sidebar).width, 10);
        try {
            localStorage.setItem(STORAGE_KEY, String(widthPx));
        } catch (_) {}
    };

    const startDragging = (e) => {
        dragging = true;
        startX = e.clientX;
        startWidth = parseInt(getComputedStyle(sidebar).width, 10);
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDragging);
    };

    // 既存リスナ重複付与防止のため、一度付与済ならスキップ
    if (!resizer.dataset.mousedownBound) {
        resizer.addEventListener('mousedown', startDragging);
        resizer.dataset.mousedownBound = '1';
    }
}