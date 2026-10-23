// Progressive enhancement: native details remains usable without JavaScript.
document.querySelectorAll('[data-about-disclosure]').forEach((details) => {
  const summary = details.querySelector('summary');
  if (!summary) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animation = null;
  let expanded = details.open;

  const finish = () => {
    details.open = expanded;
    details.style.removeProperty('overflow');
    const previous = animation;
    animation = null;
    previous?.cancel();
  };

  summary.addEventListener('click', (event) => {
    // Preserve modified clicks and native details behavior where animation is unavailable.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (reducedMotion.matches || typeof details.animate !== 'function') return;
    event.preventDefault();

    const fromHeight = details.getBoundingClientRect().height;
    expanded = !(animation ? expanded : details.open);
    animation?.cancel();
    details.open = true;
    const openHeight = details.getBoundingClientRect().height;
    const style = window.getComputedStyle(details);
    const closedHeight = summary.getBoundingClientRect().height
      + (parseFloat(style.borderTopWidth) || 0)
      + (parseFloat(style.borderBottomWidth) || 0);
    details.style.overflow = 'hidden';

    const current = details.animate(
      [{ height: `${fromHeight}px` }, { height: `${expanded ? openHeight : closedHeight}px` }],
      { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }
    );
    animation = current;
    current.onfinish = () => { if (animation === current) finish(); };
  });

  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches && animation) finish();
  });
});
