// Page tree management and drag & drop functionality

let draggedPageId = null;
let draggedElement = null;
let dropIndicator = null;

// Initialize drag and drop for page tree
export function initPageTreeDragDrop() {
    const pageTree = document.getElementById('pageTree');
    if (!pageTree) return;
    
    // Add drag and drop to all page items
    attachDragDropToPageItems();
    
    // Allow dropping on the sidebar to move to root
    const sidebar = document.querySelector('.sidebar');
    const sidebarContent = document.querySelector('.sidebar-content');
    
    if (sidebar && sidebarContent) {
        // Add dragover to prevent default and show visual feedback
        sidebar.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        sidebarContent.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Add visual feedback when dragging over empty space
            if (draggedPageId && (e.target === sidebarContent || 
                e.target.classList.contains('sidebar-content') || 
                e.target.id === 'pageTree' || 
                e.target.classList.contains('page-list'))) {
                sidebarContent.classList.add('drop-root-target');
            }
        });
        
        sidebarContent.addEventListener('dragleave', function(e) {
            // Remove visual feedback when leaving
            if (!sidebarContent.contains(e.relatedTarget) || 
                (e.relatedTarget && e.relatedTarget.classList.contains('page-item-header'))) {
                sidebarContent.classList.remove('drop-root-target');
            }
        });
        
        // Allow dropping on sidebar content to move to root
        sidebarContent.addEventListener('drop', function(e) {
            // Remove visual feedback
            sidebarContent.classList.remove('drop-root-target');
            
            // Only handle if dropped on the sidebar content itself, not on a page item
            if (e.target === sidebarContent || e.target.classList.contains('sidebar-content') || 
                e.target.id === 'pageTree' || e.target.classList.contains('page-list')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Move to root (parent_id = null)
                if (draggedPageId) {
                    movePage(draggedPageId, null);
                }
            }
        });
    }
}

function attachDragDropToPageItems() {
    const pageItems = document.querySelectorAll('.page-item-header');
    
    pageItems.forEach(header => {
        // Make draggable
        header.setAttribute('draggable', 'true');
        
        // Drag events
        header.addEventListener('dragstart', handleDragStart);
        header.addEventListener('dragend', handleDragEnd);
        
        // Drop events
        header.addEventListener('dragover', handleDragOver);
        header.addEventListener('dragenter', handleDragEnter);
        header.addEventListener('dragleave', handleDragLeave);
        header.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    const pageId = draggedElement.id.replace('header-', '');
    draggedPageId = pageId;
    
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    
    // Create drop indicator
    if (!dropIndicator) {
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';
        dropIndicator.style.position = 'absolute';
        dropIndicator.style.height = '2px';
        dropIndicator.style.background = '#2196F3';
        dropIndicator.style.left = '0';
        dropIndicator.style.right = '0';
        dropIndicator.style.pointerEvents = 'none';
        dropIndicator.style.zIndex = '1000';
        dropIndicator.style.display = 'none';
    }
}

function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    
    // Remove all drop-target classes
    document.querySelectorAll('.page-item-header').forEach(header => {
        header.classList.remove('drop-target');
        header.removeAttribute('data-drop-position');
    });
    
    // Remove root drop target indicator
    const sidebarContent = document.querySelector('.sidebar-content');
    if (sidebarContent) {
        sidebarContent.classList.remove('drop-root-target');
    }
    
    // Remove drop indicator
    if (dropIndicator && dropIndicator.parentNode) {
        dropIndicator.parentNode.removeChild(dropIndicator);
    }
    
    // Reset draggedPageId
    draggedPageId = null;
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    const targetPageId = e.currentTarget.id.replace('header-', '');
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // Calculate position (top half = before, bottom half = after)
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const position = y < height / 2 ? 'before' : 'after';
    
    // Store position on element
    e.currentTarget.setAttribute('data-drop-position', position);
    
    // Show drop indicator
    if (dropIndicator) {
        if (!dropIndicator.parentNode) {
            e.currentTarget.parentNode.appendChild(dropIndicator);
        }
        dropIndicator.style.display = 'block';
        
        if (position === 'before') {
            dropIndicator.style.top = (rect.top - e.currentTarget.parentNode.getBoundingClientRect().top) + 'px';
        } else {
            dropIndicator.style.top = (rect.bottom - e.currentTarget.parentNode.getBoundingClientRect().top) + 'px';
        }
    }
    
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    const targetPageId = e.currentTarget.id.replace('header-', '');
    
    // Don't allow dropping on itself
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // Don't add drop-target class anymore since we're using indicator
    // e.currentTarget.classList.add('drop-target');
}

function handleDragLeave(e) {
    // Only remove if we're actually leaving the element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drop-target');
    }
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    
    const targetPageId = e.currentTarget.id.replace('header-', '');
    const position = e.currentTarget.getAttribute('data-drop-position') || 'after';
    
    // Don't allow dropping on itself
    if (targetPageId === draggedPageId) {
        return;
    }
    
    // Check if target is a descendant of dragged page
    if (isDescendant(targetPageId, draggedPageId)) {
        alert('子孫ページを親にはできません');
        e.currentTarget.classList.remove('drop-target');
        return;
    }
    
    // Reorder the page
    reorderPage(draggedPageId, targetPageId, position);
    
    e.currentTarget.classList.remove('drop-target');
    e.currentTarget.removeAttribute('data-drop-position');
    return false;
}

function isDescendant(targetId, ancestorId) {
    // Check if targetId is a descendant of ancestorId
    const targetElement = document.getElementById('header-' + targetId);
    if (!targetElement) return false;
    
    const targetItem = targetElement.closest('.page-item');
    let parent = targetItem.parentElement;
    
    while (parent) {
        if (parent.id === 'children-' + ancestorId) {
            return true;
        }
        
        // Move up to next parent
        const parentItem = parent.closest('.page-item');
        if (!parentItem) break;
        
        parent = parentItem.parentElement;
        if (parent && parent.id === 'pageTree') break;
    }
    
    return false;
}

function movePage(pageId, newParentId) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    
    // If newParentId is explicitly null or undefined, send it as an empty string
    if (newParentId === null || newParentId === undefined) {
        formData.append('new_parent_id', '');
    } else {
        formData.append('new_parent_id', newParentId);
    }
    
    fetch(`/page/${pageId}/move/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the page to show updated tree
            window.location.reload();
        } else {
            alert('移動に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error moving page:', error);
        alert('移動に失敗しました');
    });
}

function reorderPage(pageId, targetPageId, position) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    formData.append('target_page_id', targetPageId);
    formData.append('position', position);
    
    fetch(`/page/${pageId}/reorder/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the page to show updated tree
            window.location.reload();
        } else {
            alert('並び替えに失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error reordering page:', error);
        alert('並び替えに失敗しました');
    });
}

export function toggleChildren(pageId) {
    const childrenElement = document.getElementById('children-' + pageId);
    const toggleBtn = document.getElementById('toggle-' + pageId);
    
    if (childrenElement) {
        if (childrenElement.classList.contains('expanded')) {
            childrenElement.classList.remove('expanded');
            toggleBtn.classList.add('collapsed');
        } else {
            childrenElement.classList.add('expanded');
            toggleBtn.classList.remove('collapsed');
        }
    }
}

export function addPageToTree(pageId, title, parentId, escapeHtml) {
    const now = new Date().toISOString();
    
    // Create new page item HTML
    const pageItemHtml = `
        <div class="page-item">
            <div class="page-item-header" id="header-${pageId}">
                <button class="toggle-btn empty">▼</button>
                <span class="page-icon" onclick="event.stopPropagation(); openIconModal(${pageId}, '📄')" title="アイコンを変更">📄</span>
                <span class="page-item-title" onclick="loadPage(${pageId})" style="flex: 1;">
                    ${escapeHtml(title)}
                </span>
                <div class="actions">
                    <button class="btn" style="background: transparent; color: #37352f; font-size: 16px; padding: 4px 6px; border: none; cursor: pointer; font-weight: bold;" onclick="event.stopPropagation(); openCreateChildModal(${pageId}, '${escapeHtml(title).replace(/'/g, "\\'")}');" title="子ページを追加">+</button>
                    <a href="/page/${pageId}/export/" class="btn" style="background: #28a745; color: white; text-decoration: none; font-size: 11px; padding: 4px 8px;" onclick="event.stopPropagation();" title="エクスポート">📥</a>
                </div>
            </div>
        </div>
    `;
    
    if (parentId) {
        // Add as child to parent
        let childrenContainer = document.getElementById('children-' + parentId);
        
        // If children container doesn't exist, create it
        if (!childrenContainer) {
            const parentHeader = document.getElementById('header-' + parentId);
            const parentItem = parentHeader.parentElement;
            
            // Update parent's toggle button
            const toggleBtn = parentHeader.querySelector('.toggle-btn');
            toggleBtn.id = 'toggle-' + parentId;
            toggleBtn.classList.remove('empty');
            toggleBtn.classList.add('collapsed');
            toggleBtn.setAttribute('onclick', `event.stopPropagation(); toggleChildren(${parentId})`);
            
            // Create children container
            childrenContainer = document.createElement('div');
            childrenContainer.id = 'children-' + parentId;
            childrenContainer.className = 'children';
            parentItem.appendChild(childrenContainer);
        }
        
        // Add new page to children
        childrenContainer.insertAdjacentHTML('beforeend', pageItemHtml);
        
        // Expand parent to show new child
        childrenContainer.classList.add('expanded');
        const toggleBtn = document.getElementById('toggle-' + parentId);
        if (toggleBtn) {
            toggleBtn.classList.remove('collapsed');
        }
    } else {
        // Add as root page
        const pageTree = document.getElementById('pageTree');
        if (pageTree) {
            pageTree.insertAdjacentHTML('beforeend', pageItemHtml);
        } else {
            // If tree doesn't exist (was empty), recreate it
            const sidebarContent = document.querySelector('.sidebar-content');
            const emptyState = sidebarContent.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
            
            const newTree = document.createElement('div');
            newTree.className = 'page-list';
            newTree.id = 'pageTree';
            newTree.innerHTML = pageItemHtml;
            sidebarContent.appendChild(newTree);
        }
    }
}

