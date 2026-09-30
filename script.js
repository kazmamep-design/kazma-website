document.documentElement.classList.add('js-enabled');
const savedLanguage = localStorage.getItem('kazmaLanguage') || 'ka';
const body = document.body;

function setLanguage(language) {
  const english = language === 'en';

  body.classList.toggle('lang-en', english);
  document.documentElement.setAttribute('lang', english ? 'en' : 'ka');
  localStorage.setItem('kazmaLanguage', english ? 'en' : 'ka');

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      button.dataset.lang === (english ? 'en' : 'ka') ? 'true' : 'false'
    );
  });

  document.querySelectorAll('[data-aria-ka][data-aria-en]').forEach((element) => {
    element.setAttribute(
      'aria-label',
      english ? element.dataset.ariaEn : element.dataset.ariaKa
    );
  });

  document.querySelectorAll('[data-alt-ka][data-alt-en]').forEach((image) => {
    image.alt = english ? image.dataset.altEn : image.dataset.altKa;
  });

  const localizedTitle = english
    ? body.dataset.pageTitleEn
    : body.dataset.pageTitleKa;

  if (localizedTitle) document.title = localizedTitle;
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

document.querySelectorAll('[data-year]').forEach((yearElement) => {
  yearElement.textContent = new Date().getFullYear();
});


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


// Homepage entrance and scroll reveal motion.
if (document.body.classList.contains('home-page')) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.body.classList.add('home-motion-ready');
  window.requestAnimationFrame(() => document.body.classList.add('page-ready'));

  const revealItems = Array.from(document.querySelectorAll('[data-reveal]'));
  revealItems.forEach((item) => item.classList.add('reveal-on-scroll'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealVisibleItems = () => {
      revealItems.forEach((item) => {
        if (item.getBoundingClientRect().top < window.innerHeight * 1.12) {
          item.classList.add('is-visible');
        }
      });
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.01,
      rootMargin: '0px 0px 14% 0px'
    });

    revealItems.forEach((item) => revealObserver.observe(item));
    revealVisibleItems();

    // Safety net: fast scrolling must never leave content waiting invisibly.
    window.setTimeout(() => {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    }, 900);
  }
}

// Open a service scope when visitors follow an existing section link.
if (document.body.classList.contains('services-page')) {
  const openLinkedService = () => {
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const scope = target.closest('details.service-scope');
    if (scope) scope.open = true;
    target.scrollIntoView({ block: 'start' });
  };
  window.requestAnimationFrame(openLinkedService);
  window.addEventListener('hashchange', openLinkedService);
}

// Portfolio page entrance, gallery reveal and lightbox.
if (document.body.classList.contains('portfolio-page')) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add('portfolio-ready'));
  });

  const revealItems = Array.from(
    document.querySelectorAll('[data-portfolio-reveal], .portfolio-gallery-item')
  );

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const portfolioObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.07,
      rootMargin: '0px 0px 8% 0px'
    });

    revealItems.forEach((item) => portfolioObserver.observe(item));
  }

  const allGalleryItems = Array.from(document.querySelectorAll('[data-lightbox]'));
  let galleryItems = allGalleryItems;
  const modal = document.querySelector('[data-lightbox-modal]');
  const modalImage = modal?.querySelector('[data-lightbox-image]');
  const modalCaption = modal?.querySelector('[data-lightbox-caption]');
  const modalCounter = modal?.querySelector('[data-lightbox-counter]');
  const closeButtons = Array.from(modal?.querySelectorAll('[data-lightbox-close]') || []);
  const previousButton = modal?.querySelector('[data-lightbox-prev]');
  const nextButton = modal?.querySelector('[data-lightbox-next]');

  let currentIndex = 0;
  let lastFocusedElement = null;
  let touchStartX = 0;
  let touchEndX = 0;

  const isEnglish = () => document.body.classList.contains('lang-en');

  const getCaption = (item) => {
    return isEnglish()
      ? item.dataset.captionEn
      : item.dataset.captionKa;
  };

  const renderLightbox = () => {
    const item = galleryItems[currentIndex];
    if (!item || !modalImage || !modalCaption || !modalCounter) return;

    modal?.classList.add('is-loading');
    modalImage.src = item.getAttribute('href');
    modalImage.alt = item.querySelector('img')?.alt || '';
    modalImage.onload = () => modal?.classList.remove('is-loading');
    modalImage.onerror = () => modal?.classList.remove('is-loading');
    modalCaption.textContent = getCaption(item) || '';
    modalCounter.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(galleryItems.length).padStart(2, '0')}`;
  };

  const openLightbox = (index, trigger) => {
    if (!modal || galleryItems.length === 0) return;
    currentIndex = index;
    lastFocusedElement = trigger || document.activeElement;
    renderLightbox();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    modal.querySelector('button[data-lightbox-close]')?.focus();
  };

  const closeLightbox = () => {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lastFocusedElement?.focus?.();
  };

  const showPrevious = () => {
    currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    renderLightbox();
  };

  const showNext = () => {
    currentIndex = (currentIndex + 1) % galleryItems.length;
    renderLightbox();
  };

  allGalleryItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const gallery = item.closest('[data-project-gallery]') || item.closest('.portfolio-gallery');
      galleryItems = gallery ? Array.from(gallery.querySelectorAll('[data-lightbox]')) : allGalleryItems;
      openLightbox(galleryItems.indexOf(item), item);
    });
  });

  closeButtons.forEach((button) => button.addEventListener('click', closeLightbox));
  previousButton?.addEventListener('click', showPrevious);
  nextButton?.addEventListener('click', showNext);

  document.addEventListener('keydown', (event) => {
    if (!modal?.classList.contains('is-open')) return;

    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showPrevious();
    if (event.key === 'ArrowRight') showNext();

    if (event.key === 'Tab') {
      const focusable = Array.from(
        modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  modal?.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0]?.screenX || 0;
  }, { passive: true });

  modal?.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0]?.screenX || 0;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) < 45) return;
    if (delta > 0) showPrevious();
    else showNext();
  }, { passive: true });

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      if (modal?.classList.contains('is-open')) renderLightbox();
    });
  });
}

// About page entrance and scroll reveal.
if (document.body.classList.contains('about-page')) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add('about-ready'));
  });

  const revealItems = Array.from(document.querySelectorAll('[data-about-reveal]'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const aboutObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.07,
      rootMargin: '0px 0px 8% 0px'
    });

    revealItems.forEach((item) => aboutObserver.observe(item));
  }
}

// Contact page entrance, scroll reveal and copy-email interaction.
if (document.body.classList.contains('contact-page')) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add('contact-ready'));
  });

  const revealItems = Array.from(document.querySelectorAll('[data-contact-reveal]'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const contactObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.07,
      rootMargin: '0px 0px 8% 0px'
    });

    revealItems.forEach((item) => contactObserver.observe(item));
  }

}
