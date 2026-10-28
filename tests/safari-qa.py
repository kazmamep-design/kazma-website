"""Production UI regression checks using Apple's native Safari WebDriver.

No dependencies, credentials, form submissions, or synthetic DOM click events.
Desktop window sizes and iOS simulator viewport sizes are reported separately.
"""
import base64
import json
import os
import pathlib
import re
import sys
import time
import traceback
import urllib.error
import urllib.request

OUT = pathlib.Path("safari-results")
OUT.mkdir(exist_ok=True)
PLATFORM = os.environ.get("QA_PLATFORM", "macos")
BASE = os.environ.get("QA_BASE_URL", "https://kazma.ge").rstrip("/")
PAGES = ["/", "/services", "/portfolio", "/about", "/contact"]
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"
report = {"platform": PLATFORM, "baseUrl": BASE, "started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "checks": []}


def require(condition, details):
    if not condition:
        raise AssertionError(json.dumps(details, ensure_ascii=False))


def wait_for(fn, timeout=15):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            value = fn()
            if value:
                return value
        except Exception as exc:
            last = exc
        time.sleep(0.1)
    raise TimeoutError(f"Condition timed out; last error: {last}")


class Safari:
    session = None

    def request(self, method, path, payload=None, session=True):
        prefix = f"/session/{self.session}" if session else ""
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request("http://127.0.0.1:4444" + prefix + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=100) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(exc.read().decode()) from exc
        value = result.get("value")
        if isinstance(value, dict) and value.get("error"):
            raise RuntimeError(json.dumps(value))
        return value

    def start(self):
        wait_for(lambda: self.request("GET", "/status", session=False), timeout=120)
        caps = {"browserName": "safari", "platformName": "iOS" if PLATFORM == "ios" else "macOS"}
        if PLATFORM == "ios":
            selected = json.loads((OUT / "selected-simulator.json").read_text())
            caps.update({"safari:useSimulator": True, "safari:deviceUDID": selected["udid"]})
            report["simulator"] = selected
        value = self.request("POST", "/session", {"capabilities": {"alwaysMatch": caps}}, session=False)
        self.session = value["sessionId"]
        report["capabilities"] = value["capabilities"]
        print("SAFARI_CAPABILITIES", json.dumps(value["capabilities"]), flush=True)
        self.request("POST", "/timeouts", {"implicit": 0, "pageLoad": 60000, "script": 20000})

    def js(self, script, *args):
        return self.request("POST", "/execute/sync", {"script": script, "args": list(args)})

    def element(self, selector):
        return self.request("POST", "/element", {"using": "css selector", "value": selector})[ELEMENT]

    def click(self, selector):
        element = self.element(selector)
        # Center before a native click so sticky headers cannot obscure lower controls.
        self.js("arguments[0].scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});", {ELEMENT: element})
        self.request("POST", f"/element/{element}/click", {})

    def key(self, value):
        self.request("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
            {"type": "keyDown", "value": value}, {"type": "keyUp", "value": value}]}]})

    def visit(self, path):
        self.request("POST", "/url", {"url": BASE + path})
        wait_for(lambda: self.js("return document.readyState === 'complete' && !!document.querySelector('.site-header');"))
        wait_for(lambda: self.js("return !document.fonts || document.fonts.status === 'loaded';"))

    def language(self, language):
        self.click(f'[data-lang="{language}"]')
        wait_for(lambda: self.js("return document.documentElement.lang; ") == language)

    def screenshot(self, label):
        safe = re.sub(r"[^a-zA-Z0-9_-]", "-", label)
        data = self.request("GET", "/screenshot")
        (OUT / (safe + ".png")).write_bytes(base64.b64decode(data))

    def viewport(self):
        return self.js("return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,ua:navigator.userAgent,touchPoints:navigator.maxTouchPoints,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};")

    def close(self):
        if self.session:
            self.request("DELETE", "")


browser = Safari()


def case(name, action):
    started = time.monotonic()
    result = {"name": name}
    try:
        result.update({"status": "passed", "details": action()})
    except Exception as exc:
        result.update({"status": "failed", "error": str(exc), "traceback": traceback.format_exc()})
        try:
            browser.screenshot("FAILED-" + name)
        except Exception:
            pass
    result["seconds"] = round(time.monotonic() - started, 2)
    report["checks"].append(result)
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(result["status"].upper(), name, result.get("error", ""), flush=True)


def layout(path, language, label):
    browser.visit(path)
    browser.language(language)
    # Scroll through visible content to load lazy images and finish reveal animations.
    height = browser.js("return document.documentElement.scrollHeight;")
    for y in range(0, height, max(200, browser.viewport()["height"] - 100)):
        browser.js("scrollTo({top:arguments[0],behavior:'instant'});", y)
        time.sleep(0.15)
    browser.js("scrollTo({top:0,behavior:'instant'});")
    time.sleep(0.35)
    data = browser.js("""
      const lang=arguments[0], hidden=lang==='ka'?'.en':'.ka';
      const visible=e=>!!e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
      return {lang:document.documentElement.lang,title:document.title,
        expectedTitle:document.body.dataset[lang==='ka'?'pageTitleKa':'pageTitleEn'],
        width:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
        h1:document.querySelectorAll('h1').length,
        wrongLanguage:[...document.querySelectorAll(hidden)].filter(visible).map(e=>e.textContent.trim()),
        images:[...document.images].filter(e=>visible(e)&&e.getAttribute('src')&&!e.closest('details:not([open]),[aria-hidden="true"]')).map(e=>({src:e.currentSrc,complete:e.complete,width:e.naturalWidth})),
        script:[...document.scripts].map(e=>e.src).find(s=>s.includes('script.js'))};
    """, language)
    require(data["lang"] == language and data["title"] == data["expectedTitle"], data)
    require(data["h1"] == 1 and not data["wrongLanguage"], data)
    require(data["scrollWidth"] <= data["clientWidth"] + 2, data)
    image_state = lambda: browser.js("return [...document.images].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&e.getAttribute('src')&&!e.closest('details:not([open]),[aria-hidden=\"true\"]')).map(e=>({src:e.currentSrc||e.src,complete:e.complete,width:e.naturalWidth}));")
    try:
        wait_for(lambda: all(i["complete"] and i["width"] > 0 for i in image_state()), timeout=20)
    except TimeoutError:
        raise AssertionError(json.dumps({"unloadedImages": [i for i in image_state() if not i["complete"] or not i["width"]]}))
    browser.screenshot(f"{label}-{language}-{path.strip('/') or 'home'}")
    return data


def menu(language):
    browser.visit("/")
    browser.language(language)
    destinations = []
    for path in PAGES[1:] + ["/"]:
        mobile = browser.js("return getComputedStyle(document.querySelector('.menu-btn')).display !== 'none';")
        if mobile:
            browser.click(".menu-btn")
            wait_for(lambda: browser.js("return document.querySelector('.menu-btn').getAttribute('aria-expanded')==='true';"))
            wait_for(lambda: browser.js("const s=getComputedStyle(document.querySelector('#primary-navigation')); return s.visibility==='visible' && Number(s.opacity)===1 && s.pointerEvents==='auto';"))
        browser.click(f'#primary-navigation a[href="{path}"]')
        wait_for(lambda: browser.js("return location.pathname;").rstrip("/") == path.rstrip("/"))
        wait_for(lambda: browser.js("return document.documentElement.lang;") == language)
        require(browser.js("return document.querySelector('.menu-btn').getAttribute('aria-expanded');") == "false", path)
        destinations.append(path)
    return {"destinations": destinations, "mobileMenu": mobile, "viewport": browser.viewport()}


def disclosures(language):
    browser.visit("/services")
    browser.language(language)
    rows = []
    for service in ["hvac", "fire-safety", "electrical-bms", "plumbing", "bms"]:
        selector = "#" + service
        if browser.js("return document.querySelector(arguments[0]).open;", selector):
            browser.click(selector + " > summary")
            wait_for(lambda: browser.js("return !document.querySelector(arguments[0]).open;", selector))
            time.sleep(0.2)
        before = browser.js("const e=document.querySelector(arguments[0]); return {height:e.getBoundingClientRect().height,color:getComputedStyle(e.querySelector('.service-scope-title')).color};", selector)
        browser.click(selector + " > summary")
        wait_for(lambda: browser.js("const e=document.querySelector(arguments[0]);return e.open && e.getAnimations().length===0;", selector))
        wait_for(lambda: browser.js("const i=document.querySelector(arguments[0]+' img'); return i.complete && i.naturalWidth>0;", selector))
        opened = browser.js("const e=document.querySelector(arguments[0]); return {height:e.getBoundingClientRect().height,color:getComputedStyle(e.querySelector('.service-scope-title')).color};", selector)
        require(opened["height"] > before["height"] + 40 and opened["color"] != before["color"], {"before": before, "opened": opened})
        browser.screenshot(f"service-{language}-{service}")
        browser.click(selector + " > summary")
        wait_for(lambda: browser.js("return !document.querySelector(arguments[0]).open;", selector))
        wait_for(lambda: browser.js("return getComputedStyle(document.querySelector(arguments[0]+' .service-scope-title')).color;", selector) == before["color"])
        closed = browser.js("const e=document.querySelector(arguments[0]); return {height:e.getBoundingClientRect().height,color:getComputedStyle(e.querySelector('.service-scope-title')).color};", selector)
        require(closed["color"] == before["color"] and abs(closed["height"] - before["height"]) < 2, {"before": before, "closed": closed})
        rows.append({"service": service, "before": before, "open": opened, "closed": closed})
    return rows


def gallery(language):
    browser.visit("/portfolio")
    browser.language(language)
    groups = []
    for group, count in [("polyphonia-case", 3), ("sameo-case", 10)]:
        selector = f"#{group} [data-lightbox]"
        items = browser.js("return [...document.querySelectorAll(arguments[0])].map(e=>({url:e.href,caption:e.dataset[arguments[1]==='ka'?'captionKa':'captionEn']}));", selector, language)
        require(len(items) == count, items)
        browser.click(selector)
        wait_for(lambda: browser.js("return document.querySelector('[data-lightbox-modal]').getAttribute('aria-hidden')==='false';"))
        for index, item in enumerate(items):
            wait_for(lambda: browser.js("const i=document.querySelector('[data-lightbox-image]');return i.complete && i.naturalWidth>0 && i.src===arguments[0];", item["url"]))
            state = browser.js("const c=document.querySelector('[data-lightbox-counter]');return {caption:document.querySelector('[data-lightbox-caption]').textContent,counter:c.textContent,nowrap:getComputedStyle(c).whiteSpace,counterHeight:c.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(c).lineHeight)};")
            require(state["caption"] == item["caption"] and state["counter"] == f"{index+1:02d} / {count:02d}", state)
            require(state["nowrap"] == "nowrap" and state["counterHeight"] < state["lineHeight"] * 1.5, state)
            if index == 1:
                browser.screenshot(f"gallery-{language}-{group}")
            browser.click("[data-lightbox-next]")
        require(browser.js("return document.querySelector('[data-lightbox-counter]').textContent;") == f"01 / {count:02d}", "Gallery did not wrap")
        browser.click("[data-lightbox-prev]")
        require(browser.js("return document.querySelector('[data-lightbox-counter]').textContent;") == f"{count:02d} / {count:02d}", "Previous did not wrap")
        browser.click("button[data-lightbox-close]")
        require(browser.js("return document.querySelector('[data-lightbox-modal]').getAttribute('aria-hidden');") == "true", "Modal did not close")
        groups.append({"group": group, "images": count, "captions": "matched", "navigation": "next/previous/wrap/close"})
    browser.click(".case-more-photos > summary")
    wait_for(lambda: browser.js("return document.querySelector('.case-more-photos').open;"))
    browser.click(".case-more-photos > summary")
    wait_for(lambda: browser.js("return !document.querySelector('.case-more-photos').open;"))
    return groups


def about(language):
    browser.visit("/about")
    browser.language(language)
    selector = "[data-about-disclosure]"
    browser.click(selector + " > summary")
    wait_for(lambda: browser.js("const d=document.querySelector(arguments[0]); return d.open && d.getAnimations().length===0;", selector))
    browser.js("const images=document.querySelectorAll(arguments[0]+' img'); images[images.length-1]?.scrollIntoView({block:'center',behavior:'instant'});", selector)
    wait_for(lambda: browser.js("return [...document.querySelectorAll(arguments[0]+' img')].every(i=>i.complete&&i.naturalWidth>0);", selector))
    browser.click(selector + " > summary")
    wait_for(lambda: browser.js("return !document.querySelector(arguments[0]).open;", selector))
    return {"openedAndClosed": True, "additionalExperienceImagesLoaded": True}


def schematic():
    browser.visit("/")
    require(not browser.viewport()["reducedMotion"], "Runner has reduced motion enabled; normal animation requires a separate environment")
    script = "return [...document.querySelectorAll('.home-route-signal')].filter(e=>e.getClientRects().length).map(e=>({offset:getComputedStyle(e).strokeDashoffset,animations:e.getAnimations().map(a=>a.playState)}));"
    before = browser.js(script)
    time.sleep(0.45)
    after = browser.js(script)
    require(before and len(before) == len(after), {"before": before, "after": after})
    require(any(a["offset"] != b["offset"] for a, b in zip(before, after)), {"before": before, "after": after})
    return {"before": before, "after": after}


def gestures():
    browser.visit("/portfolio")
    browser.click("#polyphonia-case [data-lightbox]")
    wait_for(lambda: browser.js("const i=document.querySelector('[data-lightbox-image]');return i.complete && i.naturalWidth>0;"))
    size = browser.viewport()
    x, y = int(size["width"] * 0.7), int(size["height"] * 0.45)

    def drag(dx, dy):
        browser.request("POST", "/actions", {"actions": [{"type": "pointer", "id": "finger", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "x": x, "y": y, "duration": 0, "origin": "viewport"},
            {"type": "pointerDown", "button": 0},
            {"type": "pause", "duration": 100},
            {"type": "pointerMove", "x": x + dx, "y": y + dy, "duration": 350, "origin": "viewport"},
            {"type": "pointerUp", "button": 0}]}]})

    counter = lambda: browser.js("return document.querySelector('[data-lightbox-counter]').textContent;")
    drag(-100, 0)
    wait_for(lambda: counter() == "02 / 03")
    drag(-60, 120)
    time.sleep(0.3)
    require(counter() == "02 / 03", "Vertical-dominant gesture changed photo")
    drag(100, 0)
    wait_for(lambda: counter() == "01 / 03")
    browser.click("button[data-lightbox-close]")
    return {"horizontal": "next and previous", "verticalDominant": "no photo change"}


try:
    browser.start()
    if PLATFORM == "macos":
        browser.request("POST", "/window/rect", {"width": 1440, "height": 1000})
    browser.visit("/")
    report["initialViewport"] = browser.viewport()
    sizes = [1440, 768, 390] if PLATFORM == "macos" else [None]
    for width in sizes:
        label = "ios-native" if width is None else f"desktop-window-{width}"
        if width:
            browser.request("POST", "/window/rect", {"width": width, "height": 1000})
        report.setdefault("viewports", []).append({"label": label, "requestedWindowWidth": width, **browser.viewport()})
        for language in ["ka", "en"]:
            for path in PAGES:
                case(f"{label}/{language}/{path.strip('/') or 'home'}/layout", lambda p=path, l=language, n=label: layout(p, l, n))
        if width == sizes[-1]:
            for language in ["ka", "en"]:
                case(f"{language}/navigation", lambda l=language: menu(l))
                case(f"{language}/services", lambda l=language: disclosures(l))
                case(f"{language}/gallery", lambda l=language: gallery(l))
                case(f"{language}/about", lambda l=language: about(l))
            case("home/schematic-animation", schematic)
            if PLATFORM == "ios":
                case("gallery/native-single-finger-gestures", gestures)
except Exception as exc:
    report["setupError"] = str(exc)
    report["setupTraceback"] = traceback.format_exc()
    print("SETUP_FAILED", str(exc), flush=True)
finally:
    try:
        browser.close()
    except Exception as exc:
        report["cleanupError"] = str(exc)
    report["passed"] = sum(item["status"] == "passed" for item in report["checks"])
    report["failed"] = sum(item["status"] == "failed" for item in report["checks"])
    report["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("RESULT", json.dumps({k: report.get(k) for k in ["platform", "capabilities", "initialViewport", "passed", "failed", "setupError"]}, ensure_ascii=False), flush=True)
    sys.exit(1 if report.get("setupError") or report["failed"] else 0)
