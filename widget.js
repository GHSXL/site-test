(function () {
  "use strict";

  if (window.TutorialWidget) {
    return;
  }

  var SCRIPT = document.currentScript;
  var DEFAULTS = {
    launcherLabel: "Tutoriais",
    apiBaseUrl: "",
    autoOpen: false
  };
  var EVENT_TYPES = {
    WIDGET_LOADED: "WIDGET_LOADED",
    TUTORIAL_LIST_OPENED: "TUTORIAL_LIST_OPENED",
    TUTORIAL_STARTED: "TUTORIAL_STARTED",
    STEP_VIEWED: "STEP_VIEWED",
    STEP_COMPLETED: "STEP_COMPLETED",
    TUTORIAL_COMPLETED: "TUTORIAL_COMPLETED",
    TUTORIAL_CLOSED: "TUTORIAL_CLOSED",
    ELEMENT_NOT_FOUND: "ELEMENT_NOT_FOUND"
  };

  function readConfig() {
    var globalConfig = window.TutorialWidgetConfig || {};
    var dataset = SCRIPT ? SCRIPT.dataset || {} : {};
    var explicitApiBaseUrl = globalConfig.apiBaseUrl || dataset.apiBaseUrl || "";
    var siteKey = globalConfig.siteKey || dataset.siteKey || "";
    var apiBaseUrl = explicitApiBaseUrl || inferApiBaseUrl();

    return {
      siteKey: siteKey,
      apiBaseUrl: trimTrailingSlash(apiBaseUrl),
      hasExplicitApiBaseUrl: explicitApiBaseUrl.length > 0,
      launcherLabel: globalConfig.launcherLabel || dataset.launcherLabel || DEFAULTS.launcherLabel,
      autoOpen: toBoolean(globalConfig.autoOpen, dataset.autoOpen, DEFAULTS.autoOpen)
    };
  }

  function inferApiBaseUrl() {
    if (SCRIPT && SCRIPT.src) {
      try {
        var url = new URL(SCRIPT.src, window.location.href);
        return url.origin;
      } catch (error) {
        return "";
      }
    }
    return "";
  }

  function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function toBoolean() {
    for (var index = 0; index < arguments.length; index += 1) {
      var value = arguments[index];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string" && value.length > 0) {
        return value === "true";
      }
    }
    return false;
  }

  function normalizePath(value) {
    if (!value) {
      return "/";
    }

    try {
      var url = new URL(value, window.location.href);
      return url.pathname || "/";
    } catch (error) {
      return value.charAt(0) === "/" ? value : "/" + value;
    }
  }

  function createVisitorId() {
    return "visitor_" + Math.random().toString(36).slice(2, 12);
  }

  function ensureVisitorId() {
    var storageKey = "tutorial-widget-visitor-id";
    try {
      var visitorId = window.localStorage.getItem(storageKey);
      if (!visitorId) {
        visitorId = createVisitorId();
        window.localStorage.setItem(storageKey, visitorId);
      }
      return visitorId;
    } catch (error) {
      return createVisitorId();
    }
  }

  function Widget(config) {
    this.config = config;
    this.visitorId = ensureVisitorId();
    this.tutorials = [];
    this.activeTutorial = null;
    this.activeStepIndex = -1;
    this.highlightedElement = null;
    this.tooltipElement = null;
    this.root = null;
    this.launcherButton = null;
    this.panelElement = null;
    this.statusElement = null;
    this.listElement = null;
    this.isPanelOpen = false;
    this.tutorialsLoaded = false;
  }

  Widget.prototype.init = function init() {
    if (!this.config.siteKey) {
      console.warn("[TutorialWidget] siteKey nao informado.");
      return;
    }

    if (!this.config.apiBaseUrl) {
      console.warn("[TutorialWidget] apiBaseUrl nao informado.");
      return;
    }

    this.injectStyles();
    this.buildUi();
    this.loadTutorials();
  };

  Widget.prototype.injectStyles = function injectStyles() {
    if (document.getElementById("tutorial-widget-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "tutorial-widget-styles";
    style.textContent = [
      ".tutorial-widget-root{position:fixed;right:24px;bottom:24px;z-index:2147483647;font-family:Arial,sans-serif;color:#0f172a}",
      ".tutorial-widget-launcher{border:none;border-radius:999px;padding:12px 18px;background:#0f172a;color:#fff;font-size:14px;font-weight:600;box-shadow:0 12px 32px rgba(15,23,42,.22);cursor:pointer}",
      ".tutorial-widget-panel{position:absolute;right:0;bottom:60px;width:320px;max-height:480px;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.22);border:1px solid rgba(148,163,184,.28);display:none}",
      ".tutorial-widget-panel.is-open{display:block}",
      ".tutorial-widget-header{padding:18px 18px 10px;border-bottom:1px solid #e2e8f0}",
      ".tutorial-widget-title{margin:0;font-size:16px;font-weight:700}",
      ".tutorial-widget-subtitle{margin:6px 0 0;font-size:13px;color:#475569}",
      ".tutorial-widget-status{padding:12px 18px;font-size:13px;color:#475569}",
      ".tutorial-widget-list{list-style:none;margin:0;padding:0 12px 12px}",
      ".tutorial-widget-item{padding:12px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;margin-top:10px}",
      ".tutorial-widget-item-title{margin:0 0 6px;font-size:14px;font-weight:700}",
      ".tutorial-widget-item-description{margin:0 0 10px;font-size:13px;line-height:1.5;color:#475569}",
      ".tutorial-widget-item-button,.tutorial-widget-action{border:none;border-radius:10px;padding:10px 12px;background:#2563eb;color:#fff;font-size:13px;font-weight:600;cursor:pointer}",
      ".tutorial-widget-actions{display:flex;gap:8px;padding:0 18px 18px}",
      ".tutorial-widget-action-secondary{background:#e2e8f0;color:#0f172a}",
      ".tutorial-widget-highlight{outline:3px solid #2563eb !important;outline-offset:3px !important;scroll-margin:96px}",
      ".tutorial-widget-tooltip{position:absolute;max-width:280px;background:#0f172a;color:#fff;padding:14px;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.28);z-index:2147483647}",
      ".tutorial-widget-tooltip-title{margin:0 0 6px;font-size:14px;font-weight:700}",
      ".tutorial-widget-tooltip-description{margin:0;font-size:13px;line-height:1.5;color:#cbd5e1}",
      ".tutorial-widget-tooltip-actions{display:flex;gap:8px;margin-top:12px}",
      ".tutorial-widget-tooltip-button{border:none;border-radius:10px;padding:9px 12px;background:#2563eb;color:#fff;font-size:12px;font-weight:700;cursor:pointer}",
      ".tutorial-widget-tooltip-button.is-muted{background:#334155}",
      "@media (max-width: 640px){.tutorial-widget-root{left:16px;right:16px;bottom:16px}.tutorial-widget-panel{width:auto;left:0;right:0}}"
    ].join("");

    document.head.appendChild(style);
  };

  Widget.prototype.buildUi = function buildUi() {
    var root = document.createElement("div");
    root.className = "tutorial-widget-root";

    var launcherButton = document.createElement("button");
    launcherButton.type = "button";
    launcherButton.className = "tutorial-widget-launcher";
    launcherButton.textContent = this.config.launcherLabel;
    launcherButton.addEventListener("click", this.togglePanel.bind(this));

    var panel = document.createElement("section");
    panel.className = "tutorial-widget-panel";
    panel.setAttribute("aria-live", "polite");

    var header = document.createElement("div");
    header.className = "tutorial-widget-header";
    header.innerHTML = [
      '<h2 class="tutorial-widget-title">Tutoriais disponiveis</h2>',
      '<p class="tutorial-widget-subtitle">Guias ativos para esta pagina.</p>'
    ].join("");

    var status = document.createElement("div");
    status.className = "tutorial-widget-status";
    status.textContent = "Carregando...";

    var list = document.createElement("ul");
    list.className = "tutorial-widget-list";

    panel.appendChild(header);
    panel.appendChild(status);
    panel.appendChild(list);
    root.appendChild(panel);
    root.appendChild(launcherButton);
    document.body.appendChild(root);

    this.root = root;
    this.launcherButton = launcherButton;
    this.panelElement = panel;
    this.statusElement = status;
    this.listElement = list;
  };

  Widget.prototype.togglePanel = function togglePanel() {
    this.isPanelOpen = !this.isPanelOpen;
    this.panelElement.classList.toggle("is-open", this.isPanelOpen);
    if (this.isPanelOpen && this.tutorialsLoaded) {
      this.trackEvent(EVENT_TYPES.TUTORIAL_LIST_OPENED);
    }
  };

  Widget.prototype.openPanel = function openPanel() {
    if (!this.isPanelOpen) {
      this.togglePanel();
    }
  };

  Widget.prototype.closePanel = function closePanel() {
    if (this.isPanelOpen) {
      this.togglePanel();
    }
  };

  Widget.prototype.loadTutorials = function loadTutorials() {
    var self = this;
    var endpoint = this.config.apiBaseUrl +
      "/api/public/widget/sites/" + encodeURIComponent(this.config.siteKey) +
      "/tutorials?domain=" + encodeURIComponent(window.location.hostname) +
      "&url=" + encodeURIComponent(normalizePath(window.location.pathname));

    window.fetch(endpoint, {
      method: "GET",
      credentials: "omit",
      headers: {
        Accept: "application/json"
      }
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Erro ao carregar tutoriais (" + response.status + ").");
        }
        return response.json();
      })
      .then(function (payload) {
        self.tutorialsLoaded = true;
        self.tutorials = Array.isArray(payload.tutorials) ? payload.tutorials : [];
        self.renderTutorialList();
        self.trackEvent(EVENT_TYPES.WIDGET_LOADED);
        if (self.config.autoOpen && self.tutorials.length > 0) {
          self.openPanel();
        }
      })
      .catch(function (error) {
        self.tutorialsLoaded = false;
        self.statusElement.textContent = self.getLoadErrorMessage(error);
        console.error("[TutorialWidget]", error);
      });
  };

  Widget.prototype.getLoadErrorMessage = function getLoadErrorMessage(error) {
    var message = error && error.message ? String(error.message) : "";

    if (this.shouldSuggestApiBaseUrl(message)) {
      return "Nao foi possivel carregar os tutoriais. Configure o apiBaseUrl apontando para sua API publica.";
    }

    return "Nao foi possivel carregar os tutoriais.";
  };

  Widget.prototype.shouldSuggestApiBaseUrl = function shouldSuggestApiBaseUrl(message) {
    if (this.config.hasExplicitApiBaseUrl) {
      return false;
    }

    if (!this.config.apiBaseUrl) {
      return true;
    }

    return /404|405/.test(message) || isStaticHost(this.config.apiBaseUrl);
  };

  Widget.prototype.renderTutorialList = function renderTutorialList() {
    var self = this;
    this.listElement.innerHTML = "";

    if (this.tutorials.length === 0) {
      this.statusElement.textContent = "Nenhum tutorial ativo para esta pagina.";
      return;
    }

    this.statusElement.textContent = this.tutorials.length + " tutorial(is) disponivel(is).";

    this.tutorials.forEach(function (tutorial) {
      var item = document.createElement("li");
      item.className = "tutorial-widget-item";

      var title = document.createElement("h3");
      title.className = "tutorial-widget-item-title";
      title.textContent = tutorial.name;

      var description = document.createElement("p");
      description.className = "tutorial-widget-item-description";
      description.textContent = tutorial.description || "Tutorial guiado para esta pagina.";

      var button = document.createElement("button");
      button.type = "button";
      button.className = "tutorial-widget-item-button";
      button.textContent = "Iniciar tutorial";
      button.addEventListener("click", function () {
        self.startTutorial(tutorial.id);
      });

      item.appendChild(title);
      item.appendChild(description);
      item.appendChild(button);
      self.listElement.appendChild(item);
    });
  };

  Widget.prototype.startTutorial = function startTutorial(tutorialId) {
    var tutorial = this.tutorials.find(function (entry) {
      return entry.id === tutorialId;
    });

    if (!tutorial || !Array.isArray(tutorial.steps) || tutorial.steps.length === 0) {
      return;
    }

    this.activeTutorial = tutorial;
    this.activeStepIndex = 0;
    this.closePanel();
    this.trackEvent(EVENT_TYPES.TUTORIAL_STARTED, tutorial.id);
    this.showCurrentStep();
  };

  Widget.prototype.showCurrentStep = function showCurrentStep() {
    if (!this.activeTutorial) {
      return;
    }

    var step = this.activeTutorial.steps[this.activeStepIndex];
    if (!step) {
      this.finishTutorial();
      return;
    }

    var selector = '[data-tutorial-id="' + escapeSelectorValue(step.elementKey) + '"]';
    var target = document.querySelector(selector);

    if (!target) {
      this.trackEvent(EVENT_TYPES.ELEMENT_NOT_FOUND, this.activeTutorial.id);
      this.skipMissingStep();
      return;
    }

    this.highlight(target);
    this.renderTooltip(target, step);
    this.trackEvent(EVENT_TYPES.STEP_VIEWED, this.activeTutorial.id);
  };

  Widget.prototype.highlight = function highlight(element) {
    this.clearHighlight();
    this.highlightedElement = element;
    element.classList.add("tutorial-widget-highlight");
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  };

  Widget.prototype.clearHighlight = function clearHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove("tutorial-widget-highlight");
      this.highlightedElement = null;
    }
  };

  Widget.prototype.renderTooltip = function renderTooltip(target, step) {
    var self = this;
    this.destroyTooltip();

    var tooltip = document.createElement("div");
    tooltip.className = "tutorial-widget-tooltip";

    var title = document.createElement("h4");
    title.className = "tutorial-widget-tooltip-title";
    title.textContent = step.title;

    var description = document.createElement("p");
    description.className = "tutorial-widget-tooltip-description";
    description.textContent = step.description || "";

    var actions = document.createElement("div");
    actions.className = "tutorial-widget-tooltip-actions";

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "tutorial-widget-tooltip-button is-muted";
    closeButton.textContent = "Fechar";
    closeButton.addEventListener("click", function () {
      self.stopTutorial();
    });

    var nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "tutorial-widget-tooltip-button";
    nextButton.textContent = this.activeStepIndex >= this.activeTutorial.steps.length - 1 ? "Concluir" : "Proximo";
    nextButton.addEventListener("click", function () {
      self.nextStep();
    });

    actions.appendChild(closeButton);
    actions.appendChild(nextButton);
    tooltip.appendChild(title);
    tooltip.appendChild(description);
    tooltip.appendChild(actions);
    document.body.appendChild(tooltip);

    this.tooltipElement = tooltip;
    this.positionTooltip(target, tooltip, step.position);
    window.addEventListener("resize", this.handleViewportChangeBound || (this.handleViewportChangeBound = this.handleViewportChange.bind(this)));
    window.addEventListener("scroll", this.handleViewportChangeBound, true);
  };

  Widget.prototype.handleViewportChange = function handleViewportChange() {
    if (!this.highlightedElement || !this.tooltipElement || !this.activeTutorial) {
      return;
    }

    var step = this.activeTutorial.steps[this.activeStepIndex];
    if (!step) {
      return;
    }

    this.positionTooltip(this.highlightedElement, this.tooltipElement, step.position);
  };

  Widget.prototype.positionTooltip = function positionTooltip(target, tooltip, position) {
    var rect = target.getBoundingClientRect();
    var top = window.scrollY + rect.bottom + 12;
    var left = window.scrollX + rect.left;

    if (position === "top") {
      top = window.scrollY + rect.top - tooltip.offsetHeight - 12;
    } else if (position === "left") {
      top = window.scrollY + rect.top;
      left = window.scrollX + rect.left - tooltip.offsetWidth - 12;
    } else if (position === "right") {
      top = window.scrollY + rect.top;
      left = window.scrollX + rect.right + 12;
    }

    var maxLeft = window.scrollX + document.documentElement.clientWidth - tooltip.offsetWidth - 12;
    var minLeft = window.scrollX + 12;
    var maxTop = window.scrollY + document.documentElement.clientHeight - tooltip.offsetHeight - 12;
    var minTop = window.scrollY + 12;

    tooltip.style.left = Math.max(minLeft, Math.min(left, maxLeft)) + "px";
    tooltip.style.top = Math.max(minTop, Math.min(top, maxTop)) + "px";
  };

  Widget.prototype.destroyTooltip = function destroyTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }

    if (this.handleViewportChangeBound) {
      window.removeEventListener("resize", this.handleViewportChangeBound);
      window.removeEventListener("scroll", this.handleViewportChangeBound, true);
    }
  };

  Widget.prototype.nextStep = function nextStep() {
    if (!this.activeTutorial) {
      return;
    }

    this.trackEvent(EVENT_TYPES.STEP_COMPLETED, this.activeTutorial.id);
    this.activeStepIndex += 1;
    if (this.activeStepIndex >= this.activeTutorial.steps.length) {
      this.finishTutorial();
      return;
    }
    this.showCurrentStep();
  };

  Widget.prototype.skipMissingStep = function skipMissingStep() {
    if (!this.activeTutorial) {
      return;
    }

    this.activeStepIndex += 1;
    if (this.activeStepIndex >= this.activeTutorial.steps.length) {
      this.finishTutorial();
      return;
    }
    this.showCurrentStep();
  };

  Widget.prototype.finishTutorial = function finishTutorial() {
    if (this.activeTutorial) {
      this.trackEvent(EVENT_TYPES.TUTORIAL_COMPLETED, this.activeTutorial.id);
    }

    this.resetActiveTutorial();
  };

  Widget.prototype.stopTutorial = function stopTutorial() {
    if (this.activeTutorial) {
      this.trackEvent(EVENT_TYPES.TUTORIAL_CLOSED, this.activeTutorial.id);
    }

    this.resetActiveTutorial();
  };

  Widget.prototype.resetActiveTutorial = function resetActiveTutorial() {
    this.destroyTooltip();
    this.clearHighlight();
    this.activeTutorial = null;
    this.activeStepIndex = -1;
  };

  Widget.prototype.trackEvent = function trackEvent(eventType, tutorialId) {
    if (!this.tutorialsLoaded) {
      return;
    }

    var endpoint = this.config.apiBaseUrl + "/api/public/widget/events";
    var payload = {
      siteKey: this.config.siteKey,
      tutorialId: tutorialId || null,
      eventType: eventType,
      visitorId: this.visitorId,
      pageUrl: normalizePath(window.location.pathname),
      domain: window.location.hostname
    };

    window.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {
      return null;
    });
  };

  function escapeSelectorValue(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/"/g, '\\"');
  }

  function isStaticHost(url) {
    try {
      var hostname = new URL(url, window.location.href).hostname;
      return /\.github\.io$/i.test(hostname) || /\.pages\.dev$/i.test(hostname);
    } catch (error) {
      return false;
    }
  }

  var widget = new Widget(readConfig());
  window.TutorialWidget = widget;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      widget.init();
    });
  } else {
    widget.init();
  }
})();
