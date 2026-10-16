// Pages in the drawer lay everything out side by side, so the mouse wheel scrolls sideways: the
// strip under the mouse first, then whatever holds it. Inside the drawer a page also tells the
// window the mouse is over it, so clicks never fall through to the desktop.
(function () {
  const scroller = (el) => {
    for (; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
      const x = getComputedStyle(el).overflowX;
      if ((x === 'auto' || x === 'scroll') && el.scrollWidth > el.clientWidth + 1) return el;
    }
    return null;
  };
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.defaultPrevented) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = d * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1);
    if (!px) return;
    let el = scroller(e.target);
    // A strip already at its end hands the wheel to the one around it.
    while (el) {
      const max = el.scrollWidth - el.clientWidth;
      if ((px > 0 && el.scrollLeft < max - 1) || (px < 0 && el.scrollLeft > 0)) break;
      el = scroller(el.parentElement);
    }
    if (!el) return;
    el.scrollLeft += px;
    e.preventDefault();
  }, { passive: false });

  if (window.parent === window) return;
  let last = 0;
  const here = () => {
    const now = Date.now();
    if (now - last < 120) return;
    last = now;
    window.parent.postMessage({ dmHover: true }, '*');
  };
  window.addEventListener('mousemove', here);
  window.addEventListener('mouseover', here);
})();
