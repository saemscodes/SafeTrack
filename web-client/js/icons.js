/**
 * IconResolver - Unified SVG mapper for SafeTrack
 * Restored with deep iOS design, AMOLED contrast colors, and dynamic dual-state notification bell.
 * Using window assignment to prevent Redeclaration errors in static dev environments.
 */
window.IconResolver = {
  icons: {
    map: `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16,1c-3.86,0-7,3.09-7,6.89c0,3.58,5.66,9.2,6.3,9.83C15.5,17.91,15.75,18,16,18s0.5-0.09,0.7-0.28 c0.64-0.63,6.3-6.25,6.3-9.83C23,4.09,19.86,1,16,1z" fill="#0B0C10" stroke="#A1A1AA" stroke-width="1.5"/>
        <path d="M10.5393,17.1082c-0.04-0.0191-0.09-0.0318-0.13-0.0445c0.03,0,0.06,0.0127,0.08,0.0191 C10.5093,17.0891,10.5293,17.0954,10.5393,17.1082z" fill="#02B9FC"/>
        <path d="M22.5093,17.0954c-0.05-0.0191-0.11-0.0382-0.17-0.0509c0.03,0,0.06,0.0127,0.09,0.0191 C22.4593,17.07,22.4893,17.0827,22.5093,17.0954z" fill="#02B9FC"/>
        <path d="M30.9593,30.16l-1.98-10.0545c-0.03-0.1846-0.19-0.35-0.44-0.4518l-5.89-2.4945 c-0.04-0.0255-0.09-0.0445-0.14-0.0637c-0.05-0.0191-0.11-0.0382-0.17-0.0509C22.1093,17,22.0493,17,21.9893,17c-0.08,0-0.17,0.0064-0.26,0.0254l-5.43,2.3036l-5.43-2.3036l-5.89,2.4945c-0.25,0.1018-0.41,0.2673-0.44,0.4518l-2,10.1818c-0.05,0.2355,0.12,0.4709,0.44,0.6045c0.16,0.07,0.36,0.1082,0.55,0.1082c0.17,0,0.34-0.0255,0.5-0.0827l6.5-2.3609l6.41,2.3291l6.41-2.3291l6.5,2.3609c0.16,0.0573,0.33,0.0827,0.5,0.0827c0.55,0,1-0.2864,1-0.6364 C31.0093,30.2936,30.9893,30.2236,30.9593,30.16z" fill="#120F17" stroke="#02B9FC" stroke-width="1.5"/>
        <path d="M18,7.89c0,1.11-0.9,2-2,2s-2-0.89-2-2c0-1.1,0.9-2,2-2S18,6.79,18,7.89z" fill="#02B9FC"/>
      </svg>
    `,
    contacts: `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24,14c-3.86,0-7,3.09-7,6.89c0,2.5101,2.7787,6.0173,4.6625,8.11H15v-6c0-0.5527-0.4473-1-1-1H9v-4.5801 c1.3278-1.3408,6-6.2732,6-9.5298C15,4.09,11.86,1,8,1S1,4.09,1,7.89c0,3.2567,4.6722,8.1891,6,9.5298V23c0,0.5527,0.4473,1,1,1h5 v6c0,0.5527,0.4473,1,1,1h10c0.1298,0,0.2587-0.027,0.3816-0.077c0.64-0.63,6.3-6.25,6.3-9.83C31,17.09,27.86,14,24,14z" fill="#120F17" stroke="#7C3AED" stroke-width="1.5"/>
        <path d="M10,7.89c0,1.11-0.9,2-2,2S6,9,6,7.89c0-1.1,0.9-2,2-2S10,6.79,10,7.89z" fill="#02B9FC"/>
        <path d="M26,20.89c0,1.11-0.9,2-2,2s-2-0.89-2-2c0-1.1,0.9-2,2-2S26,19.79,26,20.89z" fill="#02B9FC"/>
      </svg>
    `,
    trackers: `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23,8c0,3.52-2.61,6.44-6,6.92V26c0,0.55-0.45,1-1,1s-1-0.45-1-1V14.92c-3.39-0.48-6-3.4-6-6.92 c0-3.86,3.14-7,7-7S23,4.14,23,8z" fill="#120F17" stroke="#F59E0B" stroke-width="1.5"/>
        <path d="M16,31c-7.2715,0-15-2.103-15-6c0-2.8154,4.2764-5.0859,10.895-5.7847 c0.5552-0.0557,1.0415,0.3408,1.0996,0.8896c0.0576,0.5493-0.3403,1.0415-0.8896,1.0996C6.481,21.7979,3,23.6367,3,25 c0,1.6309,5.0645,4,13,4s13-2.3691,13-4c0-1.3633-3.481-3.2021-9.105-3.7954c-0.5493-0.0581-0.9473-0.5503-0.8896-1.0996 c0.0576-0.5488,0.5425-0.9443,1.0996-0.8896C26.7236,19.9141,31,22.1846,31,25C31,28.897,23.2715,31,16,31z" fill="#0B0C10" stroke="#7C3AED" stroke-width="1.5"/>
      </svg>
    `,
    alertsEmpty: `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.802 19.8317C15.4184 19.7699 15.8349 20.4242 15.5437 20.9539C15.3385 21.3271 15.0493 21.6529 14.7029 21.9197C14.3496 22.1918 13.9397 22.4006 13.5 22.5408C13.0601 22.6812 12.593 22.7522 12.1242 22.7522C11.6554 22.7522 11.1883 22.6812 10.7484 22.5408C10.3087 22.4006 9.89883 22.1918 9.54556 21.9197C9.1991 21.6529 8.90988 21.3271 8.70472 20.9539C8.41354 20.4242 8.83002 19.7699 9.44644 19.8317C9.63869 19.851 11.1433 19.9981 12.1242 19.9981C13.1051 19.9981 14.6097 19.851 14.802 19.8317Z" fill="#120F17" stroke="#A1A1AA" stroke-width="1.5"/>
        <path d="M8.52901 2.08755C10.7932 1.00445 13.4465 0.967602 15.7423 1.98737L15.9475 2.07851C18.3532 3.14707 19.8934 5.4622 19.8934 8.0096L19.8934 9.27297C19.8934 10.2885 20.1236 11.2918 20.5681 12.213L20.8335 12.7632C22.0525 15.29 20.465 18.2435 17.6156 18.7498L17.455 18.7783C13.93 19.4046 10.3154 19.4046 6.79044 18.7783C3.90274 18.2653 2.37502 15.1943 3.77239 12.7115L3.99943 12.3082C4.55987 11.3124 4.85335 10.1981 4.85335 9.06596L4.85335 7.79233C4.85335 5.3744 6.27704 3.16478 8.52901 2.08755Z" fill="#0B0C10" stroke="#7C3AED" stroke-width="1.5"/>
      </svg>
    `,
    alertsActive: `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.802 19.8312C15.4184 19.7694 15.8349 20.4237 15.5437 20.9534C15.3385 21.3267 15.0493 21.6524 14.7029 21.9193C14.3496 22.1913 13.9397 22.4001 13.5 22.5403C13.0601 22.6807 12.593 22.7517 12.1242 22.7517C11.6554 22.7517 11.1883 22.6807 10.7484 22.5403C10.3087 22.4001 9.89883 22.1913 9.54556 21.9193C9.1991 21.6524 8.90988 21.3267 8.70472 20.9534C8.41354 20.4237 8.83002 19.7694 9.44644 19.8312C9.63869 19.8505 11.1433 19.9976 12.1242 19.9976C13.1051 19.9976 14.6097 19.8505 14.802 19.8312Z" fill="#120F17" stroke="#A1A1AA" stroke-width="1.5"/>
        <path d="M15.7423 1.98737C13.4465 0.967602 10.7932 1.00445 8.52901 2.08755C6.27704 3.16478 4.85335 5.3744 4.85335 7.79233L4.85335 9.06596C4.85335 10.1981 4.55987 11.3124 3.99943 12.3082L3.77239 12.7115C2.37502 15.1943 3.90274 18.2653 6.79044 18.7783C10.3154 19.4046 13.93 19.4046 17.455 18.7783L17.6156 18.7498C20.465 18.2435 22.0525 15.29 20.8335 12.7632L20.5681 12.213C20.1236 11.2918 19.8934 10.2885 19.8934 9.27297V8.9514C19.4108 9.23527 18.8484 9.39807 18.248 9.39807C16.4531 9.39807 14.998 7.943 14.998 6.14807C14.998 4.6268 16.0433 3.34965 17.4547 2.99558C17.003 2.63274 16.4979 2.323 15.9475 2.07851L15.7423 1.98737Z" fill="#0B0C10" stroke="#7C3AED" stroke-width="1.5"/>
        <g id="bell-dot-group">
           <circle cx="18.248" cy="6.14844" r="3.6" fill="#EF4444"/>
           <text x="18.248" y="6.14844" font-size="2.6" font-family="'Inter', sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" id="bell-dot-text">{COUNT}</text>
        </g>
      </svg>
    `,
    'person-okay': `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="12" r="6" fill="#10B981" stroke="white" stroke-width="2"/><path d="M16,20c-5,0-9,4-9,9h18C25,24,21,20,16,20z" fill="#10B981" stroke="white" stroke-width="2"/></svg>`,
    'person-not-okay': `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="12" r="6" fill="#EF4444" stroke="white" stroke-width="2"/><path d="M16,20c-5,0-9,4-9,9h18C25,24,21,20,16,20z" fill="#EF4444" stroke="white" stroke-width="2"/><path d="M14,12l4,4M18,12l-4,4" stroke="white" stroke-width="2"/></svg>`,
    'person-got-help': `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="12" r="6" fill="#F59E0B" stroke="white" stroke-width="2"/><path d="M16,20c-5,0-9,4-9,9h18C25,24,21,20,16,20z" fill="#F59E0B" stroke="white" stroke-width="2"/><path d="M12,14l2,2l4-4" stroke="white" stroke-width="2"/></svg>`
  },

  get(name, className = "") {
    let svg = name === 'alerts' ? this.icons.alertsEmpty : (this.icons[name] || "");
    if (className) {
      svg = svg.replace("<svg", `<svg class="${className}"`);
    }
    return svg;
  },

  renderAll() {
    document.querySelectorAll("[data-icon]").forEach(el => {
      const name = el.getAttribute("data-icon");
      el.innerHTML = this.get(name);
    });
  },

  updateAlertBadge(count) {
    const alertsBtn = document.querySelector('[data-icon="alerts"]');
    if (!alertsBtn) return;
    const svgContent = count > 0 
      ? this.icons.alertsActive.replace('{COUNT}', count > 9 ? '9+' : count)
      : this.icons.alertsEmpty;
    const existingSpans = alertsBtn.innerHTML.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    alertsBtn.innerHTML = svgContent + existingSpans;
  },

  /**
   * Generates a deterministic Boring Avatar URL from a seed string.
   * Uses brand pallet: [0B0C10, 02B9FC, 7C3AED, F59E0B, EF4444]
   */
  getAvatar(seed) {
    const colors = "0B0C10,02B9FC,7C3AED,F59E0B,EF4444";
    return `https://source.boringavatars.com/beam/120/${encodeURIComponent(seed)}?colors=${colors}`;
  }
};

window.IconResolver = window.IconResolver || IconResolver;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => IconResolver.renderAll());
} else {
    IconResolver.renderAll();
}
