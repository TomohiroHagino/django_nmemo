// アイコンモーダル（DOM + 状態）
// 依存APIは共通APIモジュールへ集約
import { setPageIcon } from '../../api/pages.js';

let currentIconPageId = null;
let selectedIcon = null;

const commonIcons = [
    '📄','📝','📋','📌','📎','📇','📑','📓','📔','📕',
    '📖','📗','📘','📙','📚','📛','📜','📰','📱','💻',
    '🖥️','⌨️','🖱️','💾','💿','📀','📼','📹','📷','📸',
    '🎬','🎭','🎨','🎯','🎲','🔍','🔎','💰','💡','🔥',
    '🌟','⭐','✨','💫','🌈','🌙','☀️','⛅','☁️','🌧️',
    '🌊','🏔️','🌍','🗺️','📍','🚗','🚕','🚙','🚌','🚎',

    // チェックマーク・判定系
    '✅','❌','⭕','❎',
    '☑️','✔️','✖️',
    
    // 家庭・建物・施設
    '🏠','🏢','🏫','🏭','🏰','🗼','⛪','🕌','🎪','🎠',
    '🍎','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑',
    '⚽','🏀','🏈','⚾','🎾','🏐','🏓','🏸','🥊','🎯',
    '🎮','🎰','🃏','🀄','♠️','♥️','♦️','♣️','🂠','🎴',
    
    // 幾何学図形・形状
    '●','○','■','□','▲','△','▼','▽','◆','◇',
    '★','☆','✦','✧','✩','✪','✫','✬','✭','✮',
    '✯','✰','⭐','🌟','💫','✨','🔶','🔷','🔸','🔹',
    '🔺','🔻','💠','🔘','🔴','🟠','🟡','🟢','🔵','🟣',
    '⚫','⚪','🟤','🟥','🟧','🟨','🟩','🟦','🟪','🟫',
    '⬛','⬜','🔳','🔲','▪️','▫️','◼️','◻️','◾','◽',
    '◀️','▶️','◁','▷','⬅️','➡️','⬆️','⬇️','↗️','↘️',
    '↙️','↖️','↕️','↔️','↩️','↪️','⤴️','⤵️','🔀','🔁',
    '🔂','🔄','🔃','🔚','🔙','🔛','🔝','🔜',
    
    // 警告・情報・質問系
    '⚠️','⚠','❗','❕','❓','❔','💡','ℹ️','🔔','🔕',
    '📢','📣','📯','🔊','🔉','🔈','🔇',
    
    // 絵文字の記号系
    '🎲','🎪','🎭','🎨','🎬','🎤','🎧','🎵','🎶',
    '🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','🎁',
    '🎀','🎊','🎉','🎈','🎁','🎂','🎃','🎄','🎅','🎆',
    '🎇','✨','🎉','🎊','🎋','🎌','🎍','🎎','🎏','🎐',
    '🎑','🎀','🎁','🎂','🎃','🎄','🎅','🎆','🎇','🎈'
];

export function openIconModal(pageId, currentIcon) {
    currentIconPageId = pageId;
    selectedIcon = currentIcon;

    const modal = document.getElementById('iconModal');
    const iconGrid = document.getElementById('iconGrid');
    if (!modal || !iconGrid) return;

    iconGrid.innerHTML = '';

    commonIcons.forEach(icon => {
        const btn = document.createElement('button');
        btn.textContent = icon;
        btn.className = 'icon-btn';
        btn.style.cssText = 'font-size: 24px; padding: 8px; border: 2px solid #e5e5e5; background: #fff; cursor: pointer; border-radius: 4px; transition: all 0.2s;';

        if (icon === currentIcon) {
            btn.style.borderColor = '#2383e2';
            btn.style.background = '#f0f7ff';
        }

        btn.onmouseover = function() {
            if (icon !== currentIcon && selectedIcon !== icon) {
                this.style.borderColor = '#2383e2';
                this.style.background = '#f0f7ff';
            }
        };
        btn.onmouseout = function() {
            if (icon !== currentIcon && selectedIcon !== icon) {
                this.style.borderColor = '#e5e5e5';
                this.style.background = '#fff';
                this.style.transform = '';
            }
        };
        btn.onclick = function() {
            // 選択されたアイコンを即座に適用
            selectedIcon = icon;
            
            // アイコンを変更
            setPageIcon(currentIconPageId, icon)
                .then(() => {
                    const iconEls = document.querySelectorAll(`.page-item__header[id="header-${currentIconPageId}"] .page-item__icon`);
                    iconEls.forEach(el => { el.textContent = icon; });
                    closeIconModal();
                })
                .catch(err => {
                    console.error('Error updating icon:', err);
                    alert('アイコン変更に失敗しました');
                });
        };

        iconGrid.appendChild(btn);
    });

    modal.style.display = 'block';
}

export function closeIconModal() {
    const modal = document.getElementById('iconModal');
    if (modal) modal.style.display = 'none';
    currentIconPageId = null;
    selectedIcon = null;
}

export function confirmIconChange() {
    if (!currentIconPageId || !selectedIcon) return;

    setPageIcon(currentIconPageId, selectedIcon)
        .then(() => {
            const iconEls = document.querySelectorAll(`.page-item__header[id="header-${currentIconPageId}"] .page-item__icon`);
            iconEls.forEach(el => { el.textContent = selectedIcon; });
            closeIconModal();
        })
        .catch(err => {
            console.error('Error updating icon:', err);
            alert('アイコン変更に失敗しました');
        }
    );
}