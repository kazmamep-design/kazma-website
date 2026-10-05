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
    const event = { target: this, defaultPrevented: false, ...data };
    event.preventDefault = () => { event.defaultPrevented = true; };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
  focus() { this.focusCount += 1; }
  querySelector(selector) { return this.queries?.[selector] || null; }
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

function loadPage({ services = false, reducedMotion = false, animate = true, hash = '' } = {}) {
  const document = new Element();
  document.documentElement = new Element();
  document.body = new Element(services ? ['services-page'] : []);
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
  document.querySelector = (selector) => ({ '.menu-btn': menu, '.nav': nav })[selector] || null;
  document.querySelectorAll = (selector) => {
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
  const localStorage = { getItem: () => 'ka', setItem() {} };
  vm.runInNewContext(source, { document, window, localStorage, console, Map, Date });
  return { document, window, header, menu, nav, link, scopes };
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
