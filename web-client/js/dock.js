/**
 * SafeTrack —  Style Magnification Dock
 * Optimized with transform:scale to fix jitter and reflow issues.
 */
const AppDock = (() => {
  const DISTANCE = 200;
  const MAGNIFICATION = 1.4; // 40% scale up
  const BASE_SCALE = 1;

  function init() {
    const dock = document.querySelector('.bottom-nav');
    if (!dock) return;

    window.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 405) {
        resetDockItems();
        return;
      }

      const rect = dock.getBoundingClientRect();
      const isOverDock = (
        e.clientY >= rect.top - 100 &&
        e.clientY <= rect.bottom + 100 &&
        e.clientX >= rect.left - 50 &&
        e.clientX <= rect.right + 50
      );

      if (isOverDock) {
        updateMagnification(e.clientX);
      } else {
        resetDockItems();
      }
    });

    dock.addEventListener('mouseleave', resetDockItems);
  }

  function updateMagnification(mouseX) {
    const items = document.querySelectorAll('.nav-btn');
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - centerX);
      
      if (distance < DISTANCE) {
        const ratio = 1 - distance / DISTANCE;
        const scale = BASE_SCALE + (MAGNIFICATION - BASE_SCALE) * Math.pow(ratio, 2);
        item.style.transform = `scale(${scale})`;
        item.style.zIndex = Math.round(scale * 10);
      } else {
        item.style.transform = `scale(${BASE_SCALE})`;
        item.style.zIndex = 1;
      }
    });
  }

  function resetDockItems() {
    const items = document.querySelectorAll('.nav-btn');
    items.forEach(item => {
      item.style.transform = `scale(${BASE_SCALE})`;
      item.style.zIndex = 1;
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => AppDock.init());
