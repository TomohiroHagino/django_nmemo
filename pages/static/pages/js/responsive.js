// レスポンシブデザイン用の機能

export function initResponsive() {
    // オーバーレイ要素を作成
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    if (!sidebar) {
        console.error('Sidebar not found!');
        return;
    }
    
    if (!menuBtn) {
        console.error('Menu button not found!');
        return;
    }
    
    // ハンバーガーメニューボタンのクリックイベント
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleSidebar();
    });
    
    // オーバーレイクリックでサイドバーを閉じる
    overlay.addEventListener('click', () => {
        closeSidebar();
    });
    
    // サイドバー内のページリンクをクリックしたら閉じる
    sidebar.addEventListener('click', (e) => {
        if (e.target.classList.contains('page-item-title')) {
            closeSidebar();
        }
    });
    
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
    
    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
    
    // ウィンドウリサイズ時の処理
    window.addEventListener('resize', () => {
        const isMobile = window.innerWidth <= 480;
        if (!isMobile) {
            closeSidebar();
            sidebar.style.transform = '';
        }
    });
}

