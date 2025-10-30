// レスポンシブ: サイドバー開閉とオーバーレイ管理（多重初期化防止対応）

export function initResponsive() {
  const sidebar = document.querySelector('.sidebar');
  const menuBtn = document.getElementById('mobileMenuBtn');
  if (!sidebar || !menuBtn) return;

  // 多重初期化防止
  if (sidebar.dataset.responsiveAttached === '1') return;
  sidebar.dataset.responsiveAttached = '1';

  // 既存オーバーレイがあれば再利用、なければ作成
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
  }

  // 既存のイベント重複付与防止のため、フラグで管理
  if (!menuBtn.dataset.responsiveClick) {
      menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleSidebar();
      });
      menuBtn.dataset.responsiveClick = '1';
  }

  if (!overlay.dataset.responsiveClick) {
      overlay.addEventListener('click', () => {
          closeSidebar();
      });
      overlay.dataset.responsiveClick = '1';
  }

  if (!sidebar.dataset.responsiveInsideClick) {
      sidebar.addEventListener('click', (e) => {
          if (e.target.classList.contains('page-item-title')) {
              closeSidebar();
          }
      });
      sidebar.dataset.responsiveInsideClick = '1';
  }

  if (!window.__responsiveResizeAttached) {
      window.addEventListener('resize', () => {
          const isMobile = window.innerWidth <= 480;
          if (!isMobile) {
              closeSidebar();
              sidebar.style.transform = '';
          }
      });
      window.__responsiveResizeAttached = true;
  }

  function toggleSidebar() {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
  }

  function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
  }
}