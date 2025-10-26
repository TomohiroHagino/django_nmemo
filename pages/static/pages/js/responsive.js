// レスポンシブデザイン用の機能

export function initResponsive() {
    console.log('initResponsive called, window width:', window.innerWidth);
    
    // オーバーレイ要素を作成
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    console.log('Overlay created');
    
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    console.log('sidebar:', sidebar);
    console.log('menuBtn:', menuBtn);
    
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
        console.log('Menu button clicked!');
        e.stopPropagation();
        e.preventDefault();
        toggleSidebar();
    });
    
    console.log('Event listener added to menu button');
    
    // オーバーレイクリックでサイドバーを閉じる
    overlay.addEventListener('click', () => {
        console.log('Overlay clicked');
        closeSidebar();
    });
    
    // サイドバー内のページリンクをクリックしたら閉じる
    sidebar.addEventListener('click', (e) => {
        if (e.target.classList.contains('page-item-title')) {
            console.log('Page link clicked');
            closeSidebar();
        }
    });
    
    function toggleSidebar() {
        console.log('toggleSidebar called');
        const isOpen = sidebar.classList.contains('open');
        console.log('Current state:', isOpen ? 'open' : 'closed');
        
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
        
        console.log('New state:', sidebar.classList.contains('open') ? 'open' : 'closed');
    }
    
    function closeSidebar() {
        console.log('closeSidebar called');
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

