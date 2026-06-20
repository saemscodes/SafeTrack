/**
 * SafeTrack Demo Tour (Glassmorphism UI)
 * 
 * ONLY executes if '?demo=1' is present in the URL.
 * Creates an elegant, glassmorphic onboarding bubble.
 */

(function () {
  if (!window.location.search.includes('demo=1')) return;

  const style = document.createElement('style');
  style.textContent = `
    .st-tour-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 99998;
      pointer-events: auto;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      transition: opacity 0.3s ease;
    }
    .st-tour-bubble {
      position: fixed;
      width: 320px;
      padding: 20px;
      border-radius: 20px;
      background: rgba(20, 20, 20, 0.65);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
      z-index: 99999;
      color: #fff;
      font-family: 'SF Pro Display', 'Inter', sans-serif;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    .st-tour-bubble.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .st-tour-arrow {
      position: absolute;
      width: 0; 
      height: 0; 
      border-style: solid;
    }
    
    .st-tour-bubble[data-pos="bottom"] .st-tour-arrow {
      top: -10px;
      border-width: 0 10px 10px 10px;
      border-color: transparent transparent rgba(255, 255, 255, 0.35) transparent;
    }
    .st-tour-bubble[data-pos="top"] .st-tour-arrow {
      bottom: -10px;
      border-width: 10px 10px 0 10px;
      border-color: rgba(255, 255, 255, 0.35) transparent transparent transparent;
    }

    .st-tour-title {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0,0,0,0.4);
    }
    .st-tour-text {
      margin: 0 0 20px 0;
      font-size: 14.5px;
      line-height: 1.5;
      font-weight: 400;
      color: rgba(255,255,255,0.9);
    }
    .st-tour-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .st-tour-progress {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      font-weight: 600;
    }
    .st-tour-btn {
      background: #02B9FC;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(2, 185, 252, 0.3);
      transition: transform 0.1s, background 0.2s;
    }
    .st-tour-btn:active {
      transform: scale(0.95);
    }
    .st-tour-btn-outline {
      background: transparent;
      color: #fff;
      box-shadow: none;
      padding: 8px 0;
    }
    /* Highlight the target element */
    .st-tour-highlight {
      position: relative;
      z-index: 99999 !important;
      box-shadow: 0 0 0 4px rgba(2, 185, 252, 0.6) !important;
      border-radius: inherit;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // Simple, relatable English descriptions
  const steps = [
    {
      target: '.cal-search-input',
      title: 'The Hidden Lock',
      text: 'To anyone looking, this is just a normal calendar app. But the search bar is actually a hidden access point to sign in. Type your secret PIN there to enter the actual app.',
      position: 'bottom'
    },
    {
      target: '.cal-add-btn',
      title: 'A Working Calendar',
      text: 'You can add and save real calendar events. This makes the app look totally normal if someone is peeking onto your phone.',
      position: 'bottom'
    },
    {
      target: null,
      title: 'Silent SOS',
      text: 'Once inside, you will find a silent SOS button. Sliding it instantly sends your live location securely to your emergency contacts.',
      position: 'center'
    },
    {
      target: null,
      title: 'Leaves No Trace',
      text: 'The app never saves passwords or locations to your phone. The moment you close it, memory is totally wiped. Stay safe!',
      position: 'center'
    }
  ];

  let currentStep = 0;
  let overlay, bubble, arrow, titleEl, textEl, progressEl, nextBtn, skipBtn;
  let currentTargetEl = null;

  function initDOM() {
    overlay = document.createElement('div');
    overlay.className = 'st-tour-overlay';
    document.body.appendChild(overlay);

    bubble = document.createElement('div');
    bubble.className = 'st-tour-bubble';

    arrow = document.createElement('div');
    arrow.className = 'st-tour-arrow';

    titleEl = document.createElement('h3');
    titleEl.className = 'st-tour-title';

    textEl = document.createElement('p');
    textEl.className = 'st-tour-text';

    const footer = document.createElement('div');
    footer.className = 'st-tour-footer';

    progressEl = document.createElement('div');
    progressEl.className = 'st-tour-progress';

    const btnGroup = document.createElement('div');

    skipBtn = document.createElement('button');
    skipBtn.className = 'st-tour-btn st-tour-btn-outline';
    skipBtn.textContent = 'Skip';
    skipBtn.style.marginRight = '12px';
    skipBtn.onclick = endTour;

    nextBtn = document.createElement('button');
    nextBtn.className = 'st-tour-btn';
    nextBtn.textContent = 'Next';
    nextBtn.onclick = nextStep;

    btnGroup.appendChild(skipBtn);
    btnGroup.appendChild(nextBtn);

    footer.appendChild(progressEl);
    footer.appendChild(btnGroup);

    bubble.appendChild(arrow);
    bubble.appendChild(titleEl);
    bubble.appendChild(textEl);
    bubble.appendChild(footer);
    document.body.appendChild(bubble);
  }

  function showStep(index) {
    if (index >= steps.length) {
      endTour();
      return;
    }

    const step = steps[index];

    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    progressEl.textContent = `${index + 1} of ${steps.length}`;
    nextBtn.textContent = index === steps.length - 1 ? 'Finish' : 'Next';

    // Remove old highlight
    if (currentTargetEl) {
      currentTargetEl.classList.remove('st-tour-highlight');
    }

    let targetEl = step.target ? document.querySelector(step.target) : null;
    currentTargetEl = targetEl;

    if (targetEl) {
      targetEl.classList.add('st-tour-highlight');
      const rect = targetEl.getBoundingClientRect();

      const bubbleWidth = 320;
      const margin = 16;

      // Calculate safest left position (so it never goes offscreen)
      let calcLeft = rect.left + (rect.width / 2) - (bubbleWidth / 2);

      // Clamp horizontally
      if (calcLeft < margin) {
        calcLeft = margin;
      } else if (calcLeft + bubbleWidth > window.innerWidth - margin) {
        calcLeft = window.innerWidth - bubbleWidth - margin;
      }

      bubble.style.left = `${calcLeft}px`;

      // Calculate Arrow position relative to the bubble
      // center of target element relative to the screen:
      const targetCenter = rect.left + (rect.width / 2);
      // subtract the bubble's left edge to get relative position
      let arrowLeft = targetCenter - calcLeft;
      // Clamp arrow so it doesn't break out of the bubble's rounded corners
      arrowLeft = Math.max(20, Math.min(arrowLeft, bubbleWidth - 20));
      arrow.style.left = `${arrowLeft - 10}px`; // -10px for border-width offset

      // Calculate vertical position bounds safely
      // Try placing it below the element by default
      if (rect.bottom + 200 < window.innerHeight || step.position === 'bottom') {
        bubble.dataset.pos = 'bottom';
        bubble.style.top = `${rect.bottom + 15}px`;
        bubble.style.bottom = 'auto';
        bubble.style.transform = '';
      } else {
        bubble.dataset.pos = 'top';
        bubble.style.bottom = `${window.innerHeight - rect.top + 15}px`;
        bubble.style.top = 'auto';
        bubble.style.transform = '';
      }
      arrow.style.display = 'block';

    } else {
      // Center placement (no target)
      bubble.style.top = '50%';
      bubble.style.left = '50%';
      bubble.style.margin = '0';
      bubble.style.bottom = 'auto';
      bubble.style.transform = 'translate(-50%, -50%)';
      arrow.style.display = 'none';
      bubble.dataset.pos = 'center';
    }

    requestAnimationFrame(() => {
      bubble.classList.add('visible');
    });
  }

  function nextStep() {
    bubble.classList.remove('visible');
    setTimeout(() => {
      currentStep++;
      showStep(currentStep);
    }, 300);
  }

  function endTour() {
    if (currentTargetEl) currentTargetEl.classList.remove('st-tour-highlight');
    if (overlay) overlay.style.opacity = '0';
    if (bubble) bubble.classList.remove('visible');
    setTimeout(() => {
      if (overlay) document.body.removeChild(overlay);
      if (bubble) document.body.removeChild(bubble);
    }, 350);
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initDOM();
      showStep(0);
    }, 1500);
  });

})();
