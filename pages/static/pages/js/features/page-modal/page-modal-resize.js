export function initModalResize() {
    const modalContent = document.getElementById('modalContent');
    const handles = modalContent.querySelectorAll('.resize-handle');
    let isResizing = false, currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true; currentHandle = handle;
            startX = e.clientX; startY = e.clientY;
            const rect = modalContent.getBoundingClientRect();
            startWidth = rect.width; startHeight = rect.height;
            startLeft = rect.left; startTop = rect.top;
            modalContent.classList.add('resizing');
            e.preventDefault(); e.stopPropagation();
        });
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        let w = startWidth, h = startHeight, l = startLeft, t = startTop;

        if (currentHandle.classList.contains('resize-handle--r') ||
            currentHandle.classList.contains('resize-handle--tr') ||
            currentHandle.classList.contains('resize-handle--br')) w = Math.max(400, startWidth + dx);
        if (currentHandle.classList.contains('resize-handle--l') ||
            currentHandle.classList.contains('resize-handle--tl') ||
            currentHandle.classList.contains('resize-handle--bl')) { w = Math.max(400, startWidth - dx); l = startLeft + (startWidth - w); }
        if (currentHandle.classList.contains('resize-handle--b') ||
            currentHandle.classList.contains('resize-handle--bl') ||
            currentHandle.classList.contains('resize-handle--br')) h = Math.max(300, startHeight + dy);
        if (currentHandle.classList.contains('resize-handle--t') ||
            currentHandle.classList.contains('resize-handle--tl') ||
            currentHandle.classList.contains('resize-handle--tr')) { h = Math.max(300, startHeight - dy); t = startTop + (startHeight - h); }

        const maxW = window.innerWidth * 0.9, maxH = window.innerHeight * 0.8;
        w = Math.min(w, maxW); h = Math.min(h, maxH);

        modalContent.style.width = w + 'px';
        modalContent.style.height = h + 'px';
        modalContent.style.left = l + 'px';
        modalContent.style.top = t + 'px';
        modalContent.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) { isResizing = false; currentHandle = null; modalContent.classList.remove('resizing'); }
    });
}
