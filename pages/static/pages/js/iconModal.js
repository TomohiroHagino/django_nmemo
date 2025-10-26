// Icon selection modal functionality

let currentIconPageId = null;
let selectedIcon = null;

// よく使われるアイコンのリスト
const commonIcons = [
    '📄', '📝', '📋', '📌', '📎', '📇', '📑', '📓', '📔', '📕',
    '📖', '📗', '📘', '📙', '📚', '📛', '📜', '📰', '📱', '💻',
    '🖥️', '⌨️', '🖱️', '💾', '💿', '📀', '📼', '📹', '📷', '📸',
    '🎬', '🎭', '🎨', '🎯', '🎲', '🔍', '🔎', '💰', '💡', '🔥',
    '🌟', '⭐', '✨', '💫', '🌈', '🌙', '☀️', '⛅', '☁️', '🌧️',
    '🌊', '🏔️', '🌍', '🗺️', '📍', '🚗', '🚕', '🚙', '🚌', '🚎',
    '🏠', '🏢', '🏫', '🏭', '🏰', '🗼', '⛪', '🕌', '🎪', '🎠',
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
    '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🎯',
    '🎮', '🎰', '🃏', '🀄', '♠️', '♥️', '♦️', '♣️', '🂠', '🎴'
];

export function openIconModal(pageId, currentIcon) {
    currentIconPageId = pageId;
    selectedIcon = currentIcon;
    
    const modal = document.getElementById('iconModal');
    const iconGrid = document.getElementById('iconGrid');
    
    // アイコングリッドをクリア
    iconGrid.innerHTML = '';
    
    // アイコンを追加
    commonIcons.forEach(icon => {
        const iconBtn = document.createElement('button');
        iconBtn.textContent = icon;
        iconBtn.className = 'icon-btn';
        iconBtn.style.cssText = 'font-size: 24px; padding: 8px; border: 2px solid #e5e5e5; background: #fff; cursor: pointer; border-radius: 4px; transition: all 0.2s;';
        
        if (icon === currentIcon) {
            iconBtn.style.borderColor = '#2383e2';
            iconBtn.style.background = '#f0f7ff';
        }
        
        iconBtn.onmouseover = function() {
            // Don't change style if it's the current icon or selected
            const isCurrentIcon = icon === currentIcon;
            const isSelected = selectedIcon === icon;
            
            if (!isCurrentIcon && !isSelected) {
                this.style.borderColor = '#2383e2';
                this.style.background = '#f0f7ff';
            }
        };
        
        iconBtn.onmouseout = function() {
            // Only reset if it's not the current icon or not selected
            const isCurrentIcon = icon === currentIcon;
            const isSelected = selectedIcon === icon;
            
            if (!isCurrentIcon && !isSelected) {
                this.style.borderColor = '#e5e5e5';
                this.style.background = '#fff';
                this.style.transform = '';
            }
        };
        
        iconBtn.onclick = function() {
            // 他のボタンから選択を解除
            document.querySelectorAll('.icon-btn').forEach(btn => {
                btn.style.borderColor = '#e5e5e5';
                btn.style.background = '#fff';
            });
            
            // このボタンを選択
            selectedIcon = icon;
            this.style.borderColor = '#2383e2';
            this.style.background = '#f0f7ff';
            this.style.transform = 'scale(1.1)';
            
            // Keep the selection when mouseout
            this.onmouseout = function() {
                this.style.borderColor = '#2383e2';
                this.style.background = '#f0f7ff';
            };
            
            // Reset mouseout handler for other buttons
            document.querySelectorAll('.icon-btn').forEach(btn => {
                if (btn !== this) {
                    btn.onmouseout = function() {
                        this.style.borderColor = '#e5e5e5';
                        this.style.background = '#fff';
                        this.style.transform = '';
                    };
                }
            });
        };
        
        iconGrid.appendChild(iconBtn);
    });
    
    modal.style.display = 'block';
}

export function closeIconModal() {
    document.getElementById('iconModal').style.display = 'none';
    currentIconPageId = null;
    selectedIcon = null;
}

export function confirmIconChange() {
    if (!currentIconPageId || !selectedIcon) {
        return;
    }
    
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    const formData = new FormData();
    formData.append('icon', selectedIcon);
    
    fetch(`/page/${currentIconPageId}/icon/`, {
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
            // アイコンを更新
            const iconElements = document.querySelectorAll(`.page-item-header[id="header-${currentIconPageId}"] .page-icon`);
            iconElements.forEach(el => {
                el.textContent = selectedIcon;
            });
            
            closeIconModal();
        } else {
            alert('アイコン変更に失敗しました: ' + (data.error || '不明なエラー'));
        }
    })
    .catch(error => {
        console.error('Error updating icon:', error);
        alert('アイコン変更に失敗しました');
    });
}

