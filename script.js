document.documentElement.classList.add('js-enabled');
const savedLanguage = localStorage.getItem('kazmaLanguage') || 'ka';
const body = document.body;

function setLanguage(language) {
  if (language === 'en') {
    body.classList.add('lang-en');
    document.documentElement.setAttribute('lang', 'en');
  } else {
    body.classList.remove('lang-en');
    document.documentElement.setAttribute('lang', 'ka');
  }
  localStorage.setItem('kazmaLanguage', language);
}

setLanguage(savedLanguage);

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

const menuButton = document.querySelector('.menu-btn');
const navigation = document.querySelector('.nav');

function updateMenuLabel() {
  if (!menuButton) return;
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  const english = document.body.classList.contains('lang-en');
  menuButton.setAttribute(
    'aria-label',
    expanded
      ? (english ? 'Close menu' : 'მენიუს დახურვა')
      : (english ? 'Open menu' : 'მენიუს გახსნა')
  );
}

function setMenuState(open, returnFocus = false) {
  if (!menuButton || !navigation) return;
  navigation.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  updateMenuLabel();
  if (!open && returnFocus) menuButton.focus();
}

if (menuButton && navigation) {
  updateMenuLabel();

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    setMenuState(open);
  });

  document.addEventListener('click', (event) => {
    if (!navigation.classList.contains('open')) return;
    if (navigation.contains(event.target) || menuButton.contains(event.target)) return;
    setMenuState(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navigation.classList.contains('open')) {
      setMenuState(false, true);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720 && navigation.classList.contains('open')) {
      setMenuState(false);
    }
  });
}

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', updateMenuLabel);
});

document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('click', () => setMenuState(false));
});

const yearElement = document.querySelector('[data-year]');
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}


// Hide broken logo images and show a text fallback where needed.
document.querySelectorAll('[data-logo-img]').forEach((image) => {
  const showFallback = () => {
    image.classList.add('is-hidden');
    const fallback = image.parentElement?.querySelector('[data-logo-fallback]');
    if (fallback) fallback.classList.add('is-visible');
  };

  if (image.complete && image.naturalWidth === 0) showFallback();
  image.addEventListener('error', showFallback);
});


// Homepage Sameo project slideshow.
document.querySelectorAll('[data-project-slideshow]').forEach((slideshow) => {
  const slides = Array.from(slideshow.querySelectorAll('.home-project-slide'));
  const controls = Array.from(slideshow.querySelectorAll('.home-project-slide-controls button'));

  if (slides.length < 2) return;

  let currentIndex = 0;
  let timer = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const showSlide = (nextIndex) => {
    currentIndex = (nextIndex + slides.length) % slides.length;

    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === currentIndex);
    });

    controls.forEach((control, index) => {
      const active = index === currentIndex;
      control.classList.toggle('is-active', active);
      if (active) {
        control.setAttribute('aria-current', 'true');
      } else {
        control.removeAttribute('aria-current');
      }
    });
  };

  const stop = () => {
    slideshow.classList.add('is-paused');
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    slideshow.classList.remove('is-paused');
    if (reduceMotion || timer) return;
    timer = window.setInterval(() => showSlide(currentIndex + 1), 4500);
  };

  controls.forEach((control, index) => {
    control.addEventListener('click', () => {
      showSlide(index);
      stop();
      start();
    });
  });

  slideshow.addEventListener('mouseenter', stop);
  slideshow.addEventListener('mouseleave', start);
  slideshow.addEventListener('focusin', stop);
  slideshow.addEventListener('focusout', start);

  showSlide(0);
  start();
});


// Homepage entrance and scroll reveal motion.
if (document.body.classList.contains('home-page')) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add('page-ready'));
  });

  const revealItems = Array.from(document.querySelectorAll('[data-reveal]'));
  revealItems.forEach((item) => item.classList.add('reveal-on-scroll'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    });

    revealItems.forEach((item) => revealObserver.observe(item));
  }
}

// Services page accordion, entrance motion and scroll reveal.
if (document.body.classList.contains('services-page')) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panels = Array.from(document.querySelectorAll('[data-service-panel]'));

  const setPanelState = (panel, open) => {
    const toggle = panel.querySelector('[data-service-toggle]');
    const content = panel.querySelector('[data-service-content]');
    panel.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    content?.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const openPanel = (selectedPanel) => {
    panels.forEach((panel) => setPanelState(panel, panel === selectedPanel));
  };

  panels.forEach((panel) => {
    const toggle = panel.querySelector('[data-service-toggle]');
    toggle?.addEventListener('click', () => {
      const currentlyOpen = panel.classList.contains('is-open');
      if (currentlyOpen) {
        setPanelState(panel, false);
      } else {
        openPanel(panel);
      }
    });
  });

  const hashTarget = window.location.hash
    ? document.querySelector(window.location.hash)
    : null;

  if (hashTarget?.matches('[data-service-panel]')) {
    openPanel(hashTarget);
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add('services-ready'));
  });

  const revealItems = Array.from(document.querySelectorAll('[data-services-reveal]'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const servicesObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.06,
      rootMargin: '0px 0px 10% 0px'
    });

    revealItems.forEach((item) => servicesObserver.observe(item));
  }
}
