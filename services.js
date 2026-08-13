(() => {
  const servicesPage = document.body.classList.contains('services-page');
  if (!servicesPage) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const systemOrder = ['hvac', 'fire', 'electrical', 'plumbing', 'bms'];

  const updateLocalizedMetadata = () => {
    const english = document.body.classList.contains('lang-en');
    document.querySelectorAll('[data-content-ka][data-content-en]').forEach((element) => {
      element.setAttribute('content', english ? element.dataset.contentEn : element.dataset.contentKa);
    });
  };

  updateLocalizedMetadata();
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', updateLocalizedMetadata);
  });

  const building = document.querySelector('[data-services-building]');
  const buildingControls = Array.from(document.querySelectorAll('[data-building-control]'));
  const buildingLayers = Array.from(document.querySelectorAll('[data-building-system]'));
  let activeBuildingIndex = 0;
  let buildingTimer = null;
  let buildingInteractionLocked = false;

  const setActiveBuildingSystem = (system) => {
    activeBuildingIndex = Math.max(0, systemOrder.indexOf(system));
    buildingControls.forEach((control) => {
      const active = control.dataset.buildingControl === system;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    buildingLayers.forEach((layer) => {
      layer.classList.toggle('is-active', layer.dataset.buildingSystem === system);
    });
  };

  const stopBuildingCycle = () => {
    buildingInteractionLocked = true;
    if (buildingTimer) window.clearInterval(buildingTimer);
    buildingTimer = null;
  };

  const startBuildingCycle = () => {
    if (!building || buildingInteractionLocked || prefersReducedMotion.matches || buildingTimer) return;
    buildingTimer = window.setInterval(() => {
      activeBuildingIndex = (activeBuildingIndex + 1) % systemOrder.length;
      setActiveBuildingSystem(systemOrder[activeBuildingIndex]);
    }, 3200);
  };

  buildingControls.forEach((control) => {
    const selectControl = () => {
      stopBuildingCycle();
      setActiveBuildingSystem(control.dataset.buildingControl);
    };
    control.addEventListener('click', selectControl);
    control.addEventListener('focus', selectControl);
  });

  const handleMotionPreference = () => {
    if (prefersReducedMotion.matches) {
      if (buildingTimer) window.clearInterval(buildingTimer);
      buildingTimer = null;
    } else {
      startBuildingCycle();
    }
  };

  if (typeof prefersReducedMotion.addEventListener === 'function') {
    prefersReducedMotion.addEventListener('change', handleMotionPreference);
  }
  startBuildingCycle();

  const tabs = Array.from(document.querySelectorAll('[data-explorer-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-explorer-panel]'));
  const mobileToggles = Array.from(document.querySelectorAll('[data-mobile-system-toggle]'));
  const tabList = document.querySelector('.services-v13-system-index');
  const mobileExplorer = window.matchMedia('(max-width: 820px)');

  const syncExplorerMode = () => {
    const mobile = mobileExplorer.matches;
    if (mobile) {
      tabList?.removeAttribute('role');
      tabs.forEach((tab) => tab.removeAttribute('role'));
      panels.forEach((panel) => {
        panel.hidden = false;
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
      });
      return;
    }

    tabList?.setAttribute('role', 'tablist');
    tabs.forEach((tab) => tab.setAttribute('role', 'tab'));
    panels.forEach((panel) => {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `system-${panel.dataset.explorerPanel}-tab`);
      panel.hidden = !panel.classList.contains('is-active');
    });
  };

  const activateExplorerSystem = (system, focusTab = false) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.explorerTab === system;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
    });
    panels.forEach((panel) => {
      const active = panel.dataset.explorerPanel === system;
      panel.classList.toggle('is-active', active);
      if (active) panel.classList.add('is-open');
      if (!mobileExplorer.matches) panel.hidden = !active;
    });
    mobileToggles.forEach((toggle) => {
      if (toggle.dataset.mobileSystemToggle === system) {
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateExplorerSystem(tab.dataset.explorerTab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activateExplorerSystem(tabs[nextIndex].dataset.explorerTab, true);
    });
  });

  mobileToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const panel = panels.find((item) => item.dataset.explorerPanel === toggle.dataset.mobileSystemToggle);
      if (!panel) return;
      const open = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  const requestedSystem = window.location.hash.replace('#system-', '').replace('-panel', '');
  if (systemOrder.includes(requestedSystem)) activateExplorerSystem(requestedSystem);

  if (typeof mobileExplorer.addEventListener === 'function') {
    mobileExplorer.addEventListener('change', syncExplorerMode);
  }
  syncExplorerMode();

  window.setTimeout(() => {
    document.querySelectorAll('[data-services-reveal]').forEach((item) => item.classList.add('is-visible'));
  }, 1100);
})();
