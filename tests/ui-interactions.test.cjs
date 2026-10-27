const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.KAZMA_SCRIPT_PATH || path.join(__dirname, '..', 'script.js'), 'utf8');

class Element {
  constructor(classes = []) {
    this.classes = new Set(classes);
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, enabled = !this.classes.has(name)) => {
        enabled ? this.classes.add(name) : this.classes.delete(name);
        return enabled;
      }
    };
    this.listeners = new Map();
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.style = { removeProperty: (name) => { delete this.style[name]; } };
    this.focusCount = 0;
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  fire(type, data = {}) {
    const event = { target: this, button: 0, defaultPrevented: false, ...data };
    event.preventDefault = () => { event.defaultPrevented = true; };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
  focus() { this.focusCount += 1; }
  querySelector(selector) { return this.queries?.[selector] || null; }
  querySelectorAll(selector) { return this.queryLists?.[selector] || []; }
  closest(selector) { return this.closestElements?.[selector] || null; }
  scrollIntoView() { this.scrolled = true; }
}

function createScope(id, animate = true) {
  const scope = new Element(['service-scope']);
  const summary = new Element();
  scope.id = id;
  scope.open = false;
  scope.children = [summary];
  scope.queries = { summary };
  scope.closestElements = { 'details.service-scope': scope };
  summary.getBoundingClientRect = () => ({ height: 88 });
  scope.getBoundingClientRect = () => ({ height: scope.currentAnimation?.height ?? (scope.open ? 231 : 89) });
  scope.animations = [];
  if (animate) scope.animate = (keyframes, options) => {
    const animation = {
      keyframes, options, height: parseFloat(keyframes[0].height), cancelled: false,
      cancel() {
        this.cancelled = true;
        if (scope.currentAnimation === this) scope.currentAnimation = null;
      },
      finish() {
        this.height = parseFloat(keyframes[1].height);
        this.onfinish?.();
      }
    };
    scope.currentAnimation = animation;
    scope.animations.push(animation);
    return animation;
  };
  return { scope, summary };
}

function loadPage({ services = false, portfolio = false, reducedMotion = false, animate = true, hash = '', language = 'ka', storageFailure } = {}) {
  const document = new Element();
  document.documentElement = new Element();
  document.body = new Element(services ? ['services-page'] : []);
  if (portfolio) document.body.classList.add('portfolio-page');
  document.body.dataset = { pageTitleKa: 'ქართულად', pageTitleEn: 'English' };
  const languages = ['ka', 'en'].map((lang) => {
    const button = new Element();
    button.dataset.lang = lang;
    return button;
  });
  const localizedImage = new Element();
  localizedImage.dataset = { altKa: 'ქართული ფოტო', altEn: 'English photo' };
  const header = new Element();
  const menu = new Element();
  const nav = new Element();
  const link = new Element();
  menu.setAttribute('aria-expanded', 'false');
  menu.closestElements = { '.site-header': header };
  link.setAttribute('href', '/portfolio');
  nav.children = [link];
  nav.queries = { a: link };
  header.children = [menu, nav];
  const scopes = ['hvac', 'fire-safety'].map((id) => createScope(id, animate));
  const modal = new Element();
  const modalImage = new Element();
  const caption = new Element();
  const counter = new Element();
  const close = new Element();
  const previous = new Element();
  const next = new Element();
  modal.queries = { '[data-lightbox-image]': modalImage, '[data-lightbox-caption]': caption, '[data-lightbox-counter]': counter, '[data-lightbox-prev]': previous, '[data-lightbox-next]': next, 'button[data-lightbox-close]': close };
  modal.queryLists = { '[data-lightbox-close]': [close] };
  const gallery = new Element();
  const photos = Array.from({ length: 3 }, (_, index) => {
    const photo = new Element();
    photo.setAttribute('href', `photo-${index}.webp`);
    photo.dataset = { captionKa: `ფოტო ${index}`, captionEn: `Photo ${index}` };
    photo.queries = { img: { alt: `Photo ${index}` } };
    photo.closestElements = { '[data-project-gallery]': gallery };
    return photo;
  });
  gallery.queryLists = { '[data-lightbox]': photos };
  document.querySelector = (selector) => ({ '.menu-btn': menu, '.nav': nav, '[data-lightbox-modal]': modal })[selector] || null;
  document.querySelectorAll = (selector) => {
    if (selector === '[data-lang]') return languages;
    if (selector === '[data-alt-ka][data-alt-en]') return [localizedImage];
    if (selector === '[data-lightbox]' && portfolio) return photos;
    if (selector === '.nav a') return [link];
    if (selector === 'details.service-scope' && services) return scopes.map(({ scope }) => scope);
    return [];
  };
  document.getElementById = (id) => scopes.find(({ scope }) => scope.id === id)?.scope || null;
  const window = new Element();
  window.innerWidth = 390;
  window.location = { hash };
  window.matchMedia = () => ({ matches: reducedMotion });
  window.requestAnimationFrame = (handler) => handler();
  window.getComputedStyle = () => ({ borderTopWidth: '0px', borderBottomWidth: '1px' });
  const localStorage = {
    value: language,
    getItem() { if (storageFailure === 'read') throw new Error('Storage blocked'); return this.value; },
    setItem(key, value) { if (storageFailure === 'write') throw new Error('Storage full'); this.value = value; }
  };
  const context = { document, window, console, Map, Date };
  Object.defineProperty(context, 'localStorage', {
    get() { if (storageFailure === 'access') throw new Error('Storage unavailable'); return localStorage; }
  });
  vm.runInNewContext(source, context);
  return { document, window, header, menu, nav, link, scopes, languages, localizedImage, localStorage, modal, modalImage, caption, counter, photos, close, previous, next };
}

test('touch opening does not force focus; null focusout leaves a tapped link available', () => {
  const page = loadPage();
  page.menu.fire('click', { detail: 1 });
  assert.equal(page.link.focusCount, 0);
  page.header.fire('focusout', { relatedTarget: null });
  assert.equal(page.menu.getAttribute('aria-expanded'), 'true');
  assert.equal(page.nav.classList.contains('open'), true);
  const click = page.link.fire('click', { detail: 1 });
  assert.equal(click.defaultPrevented, false);
  assert.equal(page.link.getAttribute('href'), '/portfolio');
  assert.equal(page.menu.getAttribute('aria-expanded'), 'false');
});

test('keyboard opening focuses a link; focus leaving the header closes the panel', () => {
  const page = loadPage();
  page.menu.fire('click', { detail: 0 });
  assert.equal(page.link.focusCount, 1);
  page.header.fire('focusout', { relatedTarget: page.link });
  assert.equal(page.menu.getAttribute('aria-expanded'), 'true');
  page.header.fire('focusout', { relatedTarget: new Element() });
  assert.equal(page.menu.getAttribute('aria-expanded'), 'false');
});

test('a null focus target before a mobile link click cannot dismiss navigation', () => {
  const page = loadPage();
  page.menu.fire('click', { detail: 1 });
  page.header.fire('focusout', { relatedTarget: null });
  assert.equal(page.nav.classList.contains('open'), true);
});

test('Escape returns focus; outside clicks close without intercepting inside clicks', () => {
  const page = loadPage();
  page.menu.fire('click', { detail: 1 });
  page.document.fire('click', { target: page.link });
  assert.equal(page.nav.classList.contains('open'), true);
  page.document.fire('keydown', { key: 'Escape' });
  assert.equal(page.menu.focusCount, 1);
  assert.equal(page.nav.classList.contains('open'), false);
  page.menu.fire('click', { detail: 1 });
  page.document.fire('click', { target: new Element() });
  assert.equal(page.nav.classList.contains('open'), false);
});

test('disclosure expands to content height and stays visible until folding finishes', () => {
  const { scope, summary } = loadPage({ services: true }).scopes[0];
  assert.equal(summary.fire('click').defaultPrevented, true);
  const opening = scope.currentAnimation;
  assert.equal(opening.keyframes[0].height, '89px');
  assert.equal(opening.keyframes[1].height, '231px');
  assert.equal(opening.options.duration, 280);
  opening.finish();
  assert.equal(scope.open, true);
  assert.equal(scope.style.overflow, undefined);
  summary.fire('click');
  assert.equal(scope.open, true);
  assert.equal(scope.currentAnimation.keyframes[1].height, '89px');
  scope.currentAnimation.finish();
  assert.equal(scope.open, false);
  assert.equal(scope.currentAnimation, null);
  assert.equal(scope.style.overflow, undefined);
});

test('rapid reversal starts at the visible height and old completion cannot override it', () => {
  const { scope, summary } = loadPage({ services: true }).scopes[0];
  summary.fire('click');
  const first = scope.currentAnimation;
  first.height = 156;
  summary.fire('click');
  const second = scope.currentAnimation;
  assert.equal(first.cancelled, true);
  assert.equal(second.keyframes[0].height, '156px');
  assert.equal(second.keyframes[1].height, '89px');
  first.finish();
  assert.equal(scope.currentAnimation, second);
  second.finish();
  assert.equal(scope.open, false);
});

test('disclosures operate independently and opening during a close ends expanded', () => {
  const page = loadPage({ services: true });
  const first = page.scopes[0];
  const second = page.scopes[1];
  first.summary.fire('click');
  first.scope.currentAnimation.finish();
  first.summary.fire('click');
  first.summary.fire('click');
  second.summary.fire('click');
  second.scope.currentAnimation.finish();
  first.scope.currentAnimation.finish();
  assert.equal(first.scope.open, true);
  assert.equal(second.scope.open, true);
});

for (const options of [{ reducedMotion: true }, { animate: false }]) {
  test(`disclosure remains usable without motion: ${JSON.stringify(options)}`, () => {
    const { scope, summary } = loadPage({ services: true, ...options }).scopes[0];
    summary.fire('click');
    assert.equal(scope.open, true);
    summary.fire('click');
    assert.equal(scope.open, false);
    assert.equal(scope.animations.length, 0);
  });
}

test('deep links open immediately and cancel an in-progress close', () => {
  const page = loadPage({ services: true, hash: '#hvac' });
  const { scope, summary } = page.scopes[0];
  assert.equal(scope.open, true);
  assert.equal(scope.scrolled, true);
  assert.equal(scope.animations.length, 0);
  summary.fire('click');
  const closing = scope.currentAnimation;
  page.window.fire('hashchange');
  assert.equal(closing.cancelled, true);
  closing.finish();
  assert.equal(scope.open, true);
  assert.equal(scope.style.overflow, undefined);
});

for (const storageFailure of ['read', 'write', 'access']) {
  test(`storage ${storageFailure} failure preserves language controls, navigation and disclosures`, () => {
    const page = loadPage({ services: true, language: 'en', storageFailure });
    assert.equal(page.document.documentElement.getAttribute('lang'), storageFailure === 'write' ? 'en' : 'ka');
    for (const button of page.languages) {
      button.fire('click');
      const english = button.dataset.lang === 'en';
      assert.equal(page.document.documentElement.getAttribute('lang'), button.dataset.lang);
      assert.equal(page.document.title, english ? 'English' : 'ქართულად');
      assert.equal(page.localizedImage.alt, english ? 'English photo' : 'ქართული ფოტო');
      assert.equal(button.getAttribute('aria-pressed'), 'true');
    }
    page.menu.fire('click', { detail: 1 });
    assert.equal(page.menu.getAttribute('aria-expanded'), 'true');
    assert.equal(page.link.fire('click').defaultPrevented, false);
    assert.equal(page.menu.getAttribute('aria-expanded'), 'false');
    const { scope, summary } = page.scopes[0];
    summary.fire('click');
    scope.currentAnimation.finish();
    assert.equal(scope.open, true);
  });
}

test('available storage restores and remembers the selected language', () => {
  const page = loadPage({ language: 'en' });
  assert.equal(page.document.documentElement.getAttribute('lang'), 'en');
  page.languages[0].fire('click');
  assert.equal(page.localStorage.value, 'ka');
});

for (const click of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
  test(`gallery leaves modified and non-primary clicks to the browser: ${JSON.stringify(click)}`, () => {
    const page = loadPage({ portfolio: true });
    const event = page.photos[0].fire('click', click);
    assert.equal(event.defaultPrevented, !!click.defaultPrevented);
    assert.equal(page.modal.classList.contains('is-open'), false);
  });
}

for (const detail of [0, 1]) {
  test(`ordinary gallery activation still opens the selected photo: detail ${detail}`, () => {
    const page = loadPage({ portfolio: true });
    assert.equal(page.photos[1].fire('click', { detail }).defaultPrevented, true);
    assert.equal(page.modal.classList.contains('is-open'), true);
    assert.equal(page.modalImage.src, 'photo-1.webp');
    assert.equal(page.counter.textContent, '02 / 03');
    assert.equal(page.close.focusCount, 1);
    page.document.fire('keydown', { key: 'Escape' });
    assert.equal(page.modal.getAttribute('aria-hidden'), 'true');
    assert.equal(page.photos[1].focusCount, 1);
  });
}

const touch = (x, y, identifier = 1) => ({ screenX: x, screenY: y, identifier });
function swipe(modal, start, end) {
  modal.fire('touchstart', { touches: [start], changedTouches: [start] });
  modal.fire('touchend', { touches: [], changedTouches: [end] });
}

test('horizontal swipes move one photo in either direction and wrap at the ends', () => {
  const page = loadPage({ portfolio: true });
  page.photos[0].fire('click');
  swipe(page.modal, touch(200, 200), touch(100, 220));
  assert.equal(page.modalImage.src, 'photo-1.webp');
  swipe(page.modal, touch(100, 220), touch(200, 200));
  assert.equal(page.modalImage.src, 'photo-0.webp');
  swipe(page.modal, touch(100, 220), touch(200, 200));
  assert.equal(page.modalImage.src, 'photo-2.webp');
});

for (const end of [touch(140, 500), touch(260, -300), touch(140, 160), touch(170, 100), touch(200, 500)]) {
  test(`vertical, diagonal and short gestures keep the current photo: ${JSON.stringify(end)}`, () => {
    const page = loadPage({ portfolio: true });
    page.photos[0].fire('click');
    swipe(page.modal, touch(200, 100), end);
    assert.equal(page.modalImage.src, 'photo-0.webp');
  });
}

test('cancelled, multi-touch and unmatched gestures do not navigate or leak into later swipes', () => {
  const page = loadPage({ portfolio: true });
  page.photos[0].fire('click');
  const start = touch(200, 100);
  const end = touch(50, 100);
  page.modal.fire('touchend', { changedTouches: [end] });
  page.modal.fire('touchstart', { touches: [start], changedTouches: [start] });
  page.modal.fire('touchcancel');
  page.modal.fire('touchend', { changedTouches: [end] });
  page.modal.fire('touchstart', { touches: [start], changedTouches: [start] });
  page.modal.fire('touchstart', { touches: [start, touch(300, 100, 2)], changedTouches: [touch(300, 100, 2)] });
  page.modal.fire('touchend', { changedTouches: [end] });
  swipe(page.modal, start, touch(50, 100, 2));
  assert.equal(page.modalImage.src, 'photo-0.webp');
  swipe(page.modal, start, end);
  assert.equal(page.modalImage.src, 'photo-1.webp');
});
