/**
 * World Time Aligner - Popup Logic
 */

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
  defaultSelection: ["singapore", "new-york", "los-angeles"],
  maxCities: 6,
  storageKey: "worldTimeAlignerCities",
  mapSettingsKey: "worldTimeAlignerMapSettings_v4",
  customCitiesKey: "worldTimeAlignerCustomCities",
  timePeriodsKey: "worldTimeAlignerTimePeriods",
  languageKey: "worldTimeAlignerLanguage",
  nowLineModeKey: "worldTimeAlignerNowLineMode",
  defaultMapSettings: {
    lngOffset: 1.0,
    latOffset: 20.7,
    widthScale: 1.0,
    heightScale: 1.39,
    mapYOffset: 30
  },
  defaultTimePeriods: [
    { name: "period1", start: 8, end: 17, color: "rgba(255, 231, 163, 1)", fontColor: "#000000ff" },
    { name: "period2", start: 18, end: 23, color: "rgba(249, 190, 108, 1)", fontColor: "#000000ff" },
    { name: "period3", start: 0, end: 7, color: "rgba(133, 108, 96, 1)", fontColor: "#ffffff" }
  ]
};

// ==========================================
// 2. DOM ELEMENT CACHE
// ==========================================
const DOM = {
  cityLayer: document.querySelector("#cityLayer"),
  timelineRows: document.querySelector("#timelineRows"),
  nowLine: document.querySelector("#nowLine"),
  scrubLine: document.querySelector("#scrubLine"),
  scrubHandle: document.querySelector("#scrubHandle"),
  scrubResetBtn: document.querySelector("#scrubResetBtn"),
  timelinePanel: document.querySelector(".timeline-panel"),
  nowText: document.querySelector("#nowText"),
  resetButton: document.querySelector("#resetButton"),
  clearAllButton: document.querySelector("#clearAllButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  resetMapButton: document.querySelector("#resetMapButton"),
  resetPeriodsButton: document.querySelector("#resetPeriodsButton"),
  customCityName: document.querySelector("#customCityName"),
  customCityZone: document.querySelector("#customCityZone"),
  customCityX: document.querySelector("#customCityX"),
  customCityY: document.querySelector("#customCityY"),
  addCustomCityButton: document.querySelector("#addCustomCityButton"),
  searchCityButton: document.querySelector("#searchCityButton"),
  searchSuggestions: document.querySelector("#searchSuggestions"),
  customCityList: document.querySelector("#customCityList"),
  langSelect: document.querySelector("#langSelect"),
  nowLineModeSelect: document.querySelector("#nowLineModeSelect"),
  mapImg: document.querySelector(".world-map"),
  mapShell: document.querySelector(".map-shell"),
  timezoneHoverBar: document.querySelector("#timezoneHoverBar"),
  timezoneLines: document.querySelector(".time-zone-lines"),
  dayNightOverlay: document.querySelector("#dayNightOverlay"),
  nightPath: document.querySelector("#nightPath"),
  nightPathRef: document.querySelector("#nightPathRef")
};

// ==========================================
// 3. UTILITIES
// ==========================================
const MathUtils = {
  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
};

const TimeUtils = {
  resolveZone(zone) {
    if (!zone) return "";
    const cleanInput = zone.trim().toLowerCase().replace(/[\s\-_]+/g, "");

    // 1. Try case-insensitive and loose matching against browser supported zones
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      try {
        const supported = Intl.supportedValuesOf("timeZone");
        // Look for exact match (ignoring case/spaces/hyphens/underscores)
        let match = supported.find(tz => tz.toLowerCase().replace(/[\s\-_]+/g, "") === cleanInput);
        if (match) return match;

        // Look for shorthand match (e.g. "taipei" matches "Asia/Taipei")
        match = supported.find(tz => {
          const parts = tz.toLowerCase().split("/");
          return parts[parts.length - 1].replace(/[\s\-_]+/g, "") === cleanInput;
        });
        if (match) return match;
      } catch (e) { }
    }

    // 2. Direct validation fallback (handles UTC offsets, Etc/GMT, etc.)
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
      return zone;
    } catch { }

    // 3. Compatibility fallback for older browsers
    const prefixes = ["Asia", "Europe", "America", "Australia", "Africa", "Pacific", "Atlantic", "Indian"];
    const formatted = zone.trim().replace(/\s+/g, "_");
    for (const prefix of prefixes) {
      const candidate = `${prefix}/${formatted}`;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
        return candidate;
      } catch { }
    }
    return zone;
  },

  isValidZone(zone) {
    const resolved = this.resolveZone(zone);
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: resolved }).format(new Date());
      return true;
    } catch {
      return false;
    }
  },

  formatTime(date, zone, options = {}) {
    const resolved = this.resolveZone(zone);
    const locale = State.currentLang === "zh" ? "zh-TW" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      timeZone: resolved,
      hour: "2-digit",
      minute: options.withMinutes === false ? undefined : "2-digit",
      hour12: false,
      weekday: options.weekday ? "short" : undefined
    }).format(date);
  },

  hourInZone(date, zone) {
    const resolved = this.resolveZone(zone);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: resolved,
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    return Number(parts.find((part) => part.type === "hour").value);
  },

  utcOffsetText(date, zone) {
    const resolved = this.resolveZone(zone);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: resolved,
      timeZoneName: "shortOffset"
    }).formatToParts(date);
    const offset = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    const match = offset.match(/^GMT([+-])?(\d{1,2})?(?::?(\d{2}))?$/);
    if (!match || !match[1]) return "UTC+0";

    const sign = match[1];
    const hour = Number(match[2] || 0);
    const minute = match[3] ? `:${match[3]}` : "";
    return `UTC${sign}${hour}${minute}`;
  },

  getOffsetMinutes(date, zone) {
    const resolved = this.resolveZone(zone);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: resolved,
      timeZoneName: "longOffset"
    }).formatToParts(date);
    const offsetStr = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    if (offsetStr === "GMT") return 0;

    const match = offsetStr.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return 0;

    const sign = match[1] === "+" ? 1 : -1;
    const hours = Number(match[2]);
    const minutes = match[3] ? Number(match[3]) : 0;
    return sign * (hours * 60 + minutes);
  },

  isCurrentlyDST(zone) {
    try {
      const resolved = this.resolveZone(zone);
      const currentYear = new Date().getFullYear();

      const jan = new Date(Date.UTC(currentYear, 0, 1));
      const jul = new Date(Date.UTC(currentYear, 6, 1));

      const janOffset = this.getOffsetMinutes(jan, resolved);
      const julOffset = this.getOffsetMinutes(jul, resolved);

      if (janOffset === julOffset) {
        return false;
      }

      const maxOffset = Math.max(janOffset, julOffset);
      const curOffset = this.getOffsetMinutes(new Date(), resolved);

      return curOffset === maxOffset;
    } catch {
      return false;
    }
  },

};

// ==========================================
// 3b. I18N UTILITIES
// ==========================================
const I18nUtils = {
  getTranslation(key, params = {}) {
    let text = (typeof i18nTranslations !== "undefined" && i18nTranslations[State.currentLang]?.[key]) || "";
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replace(`{${pKey}}`, pVal);
    }
    return text;
  },

  getCityName(city) {
    if (!city) return "";
    if (city.id.startsWith("custom-")) {
      return city.name;
    }
    return (typeof i18nCityNames !== "undefined" && i18nCityNames[State.currentLang]?.[city.id]) || city.id;
  }
};

// ==========================================
// 3c. TIME PERIOD UTILITIES
// ==========================================
const PeriodUtils = {
  getHourStyle(hour) {
    const period = State.timePeriods.find((p) => {
      if (p.start <= p.end) {
        return hour >= p.start && hour <= p.end;
      } else {
        return hour >= p.start || hour <= p.end;
      }
    });
    return period || State.timePeriods[2];
  }
};

const MapUtils = {
  mapPosition(city) {
    let cx = city.x;
    let cy = city.y;
    if (typeof city.lng === "number" && typeof city.lat === "number") {
      cx = 0.2816 * city.lng + 46.2357;
      cy = -0.5257 * city.lat + 63.3239;
    }
    return {
      x: MathUtils.clamp(50 + (cx - 50) * State.mapSettings.widthScale + State.mapSettings.lngOffset, 0, 100),
      y: MathUtils.clamp(50 + (cy - 50) * State.mapSettings.heightScale - State.mapSettings.latOffset, 0, 100)
    };
  },

  getLongitudeX(lng) {
    const cx = 0.2816 * lng + 46.2357;
    return 50 + (cx - 50) * State.mapSettings.widthScale + State.mapSettings.lngOffset;
  },

  getXLongitude(x) {
    const cx = 50 + (x - 50 - State.mapSettings.lngOffset) / State.mapSettings.widthScale;
    return (cx - 46.2357) / 0.2816;
  }
};

// ==========================================
// 3d. TIMELINE COORDINATE UTILITIES
// ==========================================
const TimelineUtils = {
  /**
   * Returns the current "time of day" as a fraction (0.0 ~ 1.0) on the
   * first city's 0-24 hr axis.
   * - 'local' mode: uses browser local time-of-day
   * - 'firstCity' mode: uses first city's local time-of-day
   */
  getNowFraction() {
    const now = new Date();
    let hours, minutes;

    if (State.nowLineMode === "firstCity" && State.selectedIds.length > 0) {
      const firstCity = State.findCity(State.selectedIds[0]);
      if (firstCity) {
        const zone = TimeUtils.resolveZone(firstCity.zone);
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23"
        }).formatToParts(now);
        hours = Number(parts.find((p) => p.type === "hour").value);
        minutes = Number(parts.find((p) => p.type === "minute").value);
      } else {
        hours = now.getHours();
        minutes = now.getMinutes();
      }
    } else {
      // Default: browser local time
      hours = now.getHours();
      minutes = now.getMinutes();
    }

    return (hours + minutes / 60) / 24;
  },

  /** Returns the pixel left-offset (relative to .timeline-panel) for a given 0~1 fraction */
  fractionToLeft(fraction) {
    const hoursEl = document.querySelector(".timeline-row .hours");
    if (!hoursEl || !DOM.timelinePanel) return 0;
    const gridRect = hoursEl.getBoundingClientRect();
    const panelRect = DOM.timelinePanel.getBoundingClientRect();
    const gridLeft = gridRect.left - panelRect.left;
    return gridLeft + fraction * gridRect.width;
  },

  /** Converts a pixel x (relative to .timeline-panel left) into a 0~1 fraction */
  leftToFraction(pxLeft) {
    const hoursEl = document.querySelector(".timeline-row .hours");
    if (!hoursEl || !DOM.timelinePanel) return 0;
    const gridRect = hoursEl.getBoundingClientRect();
    const panelRect = DOM.timelinePanel.getBoundingClientRect();
    const gridLeft = gridRect.left - panelRect.left;
    return MathUtils.clamp((pxLeft - gridLeft) / gridRect.width, 0, 1);
  }
};

// ==========================================
// 4. APPLICATION STATE MANAGEMENT
// ==========================================
const State = {
  selectedIds: [],
  customCities: [],
  mapSettings: {},
  timePeriods: [],
  currentLang: "zh",
  baseHours: [],
  selectedOffsetHours: null,
  nowLineMode: "local",   // 'local' | 'firstCity'
  scrubFraction: null,    // 0.0 ~ 1.0 position on 0-24hr axis, null = follow now

  init() {
    this.currentLang = this.loadLanguage();
    this.timePeriods = this.loadTimePeriods();
    this.mapSettings = this.loadMapSettings();
    this.customCities = this.loadCustomCities();
    this.selectedIds = this.loadSelection();
    this.nowLineMode = this.loadNowLineMode();
    this.selectedOffsetHours = null;
    this.scrubFraction = null;
    this.makeBaseHours();
  },

  loadLanguage() {
    try {
      const saved = localStorage.getItem(CONFIG.languageKey);
      if (saved === "zh" || saved === "en") return saved;
    } catch { }
    const navLang = navigator.language || navigator.userLanguage || "zh";
    return navLang.toLowerCase().startsWith("en") ? "en" : "zh";
  },

  saveLanguage(lang) {
    this.currentLang = lang;
    try {
      localStorage.setItem(CONFIG.languageKey, lang);
    } catch { }
  },

  loadTimePeriods() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.timePeriodsKey));
      if (Array.isArray(saved) && saved.length === 3) {
        return saved;
      }
    } catch { }
    return JSON.parse(JSON.stringify(CONFIG.defaultTimePeriods));
  },

  saveTimePeriods() {
    try {
      localStorage.setItem(CONFIG.timePeriodsKey, JSON.stringify(this.timePeriods));
    } catch { }
  },

  loadMapSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.mapSettingsKey));
      if (saved && typeof saved === "object") {
        return {
          ...CONFIG.defaultMapSettings,
          lngOffset: Number.isFinite(Number(saved.lngOffset)) ? Number(saved.lngOffset) : CONFIG.defaultMapSettings.lngOffset,
          latOffset: Number.isFinite(Number(saved.latOffset)) ? Number(saved.latOffset) : CONFIG.defaultMapSettings.latOffset,
          widthScale: Number.isFinite(Number(saved.widthScale)) ? Number(saved.widthScale) : CONFIG.defaultMapSettings.widthScale,
          heightScale: Number.isFinite(Number(saved.heightScale)) ? Number(saved.heightScale) : CONFIG.defaultMapSettings.heightScale,
          mapYOffset: Number.isFinite(Number(saved.mapYOffset)) ? Number(saved.mapYOffset) : CONFIG.defaultMapSettings.mapYOffset
        };
      }
    } catch {
      localStorage.removeItem(CONFIG.mapSettingsKey);
    }
    return { ...CONFIG.defaultMapSettings };
  },

  saveMapSettings() {
    localStorage.setItem(CONFIG.mapSettingsKey, JSON.stringify(this.mapSettings));
  },

  loadCustomCities() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.customCitiesKey));
      if (Array.isArray(saved)) {
        return saved
          .filter((city) => city && typeof city.id === "string" && typeof city.name === "string" && typeof city.zone === "string")
          .map((city) => ({
            id: city.id,
            name: city.name,
            zone: city.zone,
            x: Number.isFinite(Number(city.x)) ? Number(city.x) : 50,
            y: Number.isFinite(Number(city.y)) ? Number(city.y) : 50
          }));
      }
    } catch {
      localStorage.removeItem(CONFIG.customCitiesKey);
    }
    return [];
  },

  saveCustomCities() {
    localStorage.setItem(CONFIG.customCitiesKey, JSON.stringify(this.customCities));
  },

  loadSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey));
      if (Array.isArray(saved)) {
        return saved.filter((id) => this.allCities().some((city) => city.id === id)).slice(0, CONFIG.maxCities);
      }
    } catch {
      localStorage.removeItem(CONFIG.storageKey);
    }
    return [...CONFIG.defaultSelection];
  },

  saveSelection() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.selectedIds));
  },

  allCities() {
    return [...cityCatalog, ...this.customCities];
  },

  findCity(id) {
    return this.allCities().find((city) => city.id === id);
  },

  loadNowLineMode() {
    try {
      const saved = localStorage.getItem(CONFIG.nowLineModeKey);
      if (saved === "local" || saved === "firstCity") return saved;
    } catch { }
    return "local";
  },

  saveNowLineMode(mode) {
    this.nowLineMode = mode;
    try {
      localStorage.setItem(CONFIG.nowLineModeKey, mode);
    } catch { }
  },

  makeBaseHours() {
    const now = new Date();
    const firstCity = this.selectedIds.length > 0 ? this.findCity(this.selectedIds[0]) : null;

    if (firstCity && firstCity.zone) {
      const zone = TimeUtils.resolveZone(firstCity.zone);
      // Get today's date string in first city's timezone (YYYY-MM-DD via en-CA locale)
      const dateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(now);
      const [year, month, day] = dateStr.split("-").map(Number);
      // Use UTC offset at noon to avoid DST edge-cases within a single day
      const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
      const offsetMins = TimeUtils.getOffsetMinutes(noonUTC, zone);
      const midnightUTC = Date.UTC(year, month - 1, day, 0) - offsetMins * 60000;
      this.baseHours = Array.from({ length: 24 }, (_, i) => new Date(midnightUTC + i * 3600000));
    } else {
      // Fallback: browser local midnight
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      this.baseHours = Array.from({ length: 24 }, (_, i) => new Date(start.getTime() + i * 3600000));
    }
  },

  toggleCity(id) {
    if (State.selectedIds.includes(id)) {
      State.selectedIds = State.selectedIds.filter((item) => item !== id);
      if (id.startsWith("custom-")) {
        State.customCities = State.customCities.filter((city) => city.id !== id);
        State.saveCustomCities();
      }
    } else {
      State.selectedIds = [...State.selectedIds.slice(-(CONFIG.maxCities - 1)), id];
    }
    State.saveSelection();
    Renderer.render();
  }
};

// ==========================================
// 5. UI RENDERER
// ==========================================
const Renderer = {
  applyLanguage() {
    document.querySelectorAll("[data-i18n]").forEach((elem) => {
      const key = elem.dataset.i18n;
      if (i18nTranslations[State.currentLang]?.[key]) {
        elem.textContent = i18nTranslations[State.currentLang][key];
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((elem) => {
      const key = elem.dataset.i18nPlaceholder;
      if (i18nTranslations[State.currentLang]?.[key]) {
        elem.placeholder = i18nTranslations[State.currentLang][key];
      }
    });

    document.querySelectorAll("[data-i18n-title]").forEach((elem) => {
      const key = elem.dataset.i18nTitle;
      if (i18nTranslations[State.currentLang]?.[key]) {
        elem.title = i18nTranslations[State.currentLang][key];
      }
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((elem) => {
      const key = elem.dataset.i18nAriaLabel;
      if (i18nTranslations[State.currentLang]?.[key]) {
        elem.setAttribute("aria-label", i18nTranslations[State.currentLang][key]);
      }
    });
  },

  renderNowText() {
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}/${month}/${day}`;
    const timeStr = TimeUtils.formatTime(now, localZone);
    DOM.nowText.innerHTML = `<span class="now-date">${dateStr}</span><span class="now-time">${timeStr}</span>`;
  },

  renderMap() {
    if (DOM.mapImg) {
      DOM.mapImg.style.transform = `translateY(calc(-50% + ${State.mapSettings.mapYOffset || 0}px))`;
    }
    if (DOM.cityLayer) {
      DOM.cityLayer.style.transform = `translateY(${State.mapSettings.mapYOffset || 0}px)`;
    }
    DOM.cityLayer.innerHTML = "";
    State.allCities().forEach((city) => {
      if (city.id.startsWith("custom-utc-")) return;
      const position = MapUtils.mapPosition(city);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `city-pin${State.selectedIds.includes(city.id) ? " is-selected" : ""}`;
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}%`;
      const cityName = I18nUtils.getCityName(city);
      button.title = cityName;
      button.setAttribute("aria-label", I18nUtils.getTranslation("selectCity", { name: cityName }));
      button.addEventListener("click", () => State.toggleCity(city.id));
      DOM.cityLayer.append(button);
    });
  },

  formatSettingValue(key) {
    if (key.endsWith("Scale")) return State.mapSettings[key].toFixed(2);
    if (key === "mapYOffset") return String(Math.round(State.mapSettings[key]));
    return State.mapSettings[key].toFixed(1);
  },

  renderSettingsControls() {
    document.querySelectorAll("[data-setting]").forEach((input) => {
      const key = input.dataset.setting;
      input.value = String(State.mapSettings[key]);
    });

    document.querySelectorAll("[data-output]").forEach((output) => {
      const key = output.dataset.output;
      output.textContent = this.formatSettingValue(key);
    });
  },

  renderRows() {
    DOM.timelineRows.innerHTML = "";
    State.selectedIds.forEach((id) => {
      const city = State.findCity(id);
      if (!city) return;
      const row = document.createElement("article");
      row.className = "timeline-row";

      const label = document.createElement("div");
      label.className = "city-label";

      const cityName = I18nUtils.getCityName(city);
      const labelText = document.createElement("div");
      labelText.className = "city-label-text";
      const dstSuffix = TimeUtils.isCurrentlyDST(city.zone)
        ? ` <span title="${I18nUtils.getTranslation("dstTooltip")}">${I18nUtils.getTranslation("dstLabel")}</span>`
        : "";
      labelText.innerHTML = `<span class="city-name">${cityName}</span><span class="city-time">${TimeUtils.utcOffsetText(new Date(), city.zone)} · ${TimeUtils.formatTime(new Date(), city.zone)}${dstSuffix}</span>`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-city-btn";
      removeBtn.textContent = "×";
      removeBtn.title = I18nUtils.getTranslation("removeCity", { name: cityName });
      removeBtn.setAttribute("aria-label", I18nUtils.getTranslation("removeCity", { name: cityName }));
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        State.toggleCity(city.id);
      });

      label.append(labelText, removeBtn);

      const hours = document.createElement("div");
      hours.className = "hours";

      State.baseHours.forEach((date, index) => {
        const cityHour = TimeUtils.hourInZone(date, city.zone);
        const cell = document.createElement("div");
        cell.className = `hour-cell${index === 0 ? " is-now" : ""}`;
        cell.dataset.index = String(index);
        cell.textContent = String(cityHour).padStart(2, "0");
        cell.title = `${cityName} ${TimeUtils.formatTime(date, city.zone)}`;

        const styleInfo = PeriodUtils.getHourStyle(cityHour);
        cell.style.backgroundColor = styleInfo.color;
        cell.style.color = styleInfo.fontColor;

        hours.append(cell);
      });

      row.append(label, hours);
      DOM.timelineRows.append(row);
    });
  },

  renderCustomCityEditor() {
    DOM.customCityList.innerHTML = "";
    State.customCities.forEach((city) => {
      const item = document.createElement("div");
      item.className = "custom-city-item";
      item.innerHTML = `
        <input data-field="name" value="${city.name.replaceAll('"', "&quot;")}">
        <input data-field="zone" value="${city.zone.replaceAll('"', "&quot;")}">
        <input data-field="x" type="number" min="0" max="100" step="0.1" value="${city.x}">
        <input data-field="y" type="number" min="0" max="100" step="0.1" value="${city.y}">
        <button type="button">${I18nUtils.getTranslation("updateBtn")}</button>
        <button type="button">${I18nUtils.getTranslation("deleteBtn")}</button>
      `;

      const inputs = item.querySelectorAll("input");
      const updateButton = item.querySelectorAll("button")[0];
      const deleteButton = item.querySelectorAll("button")[1];

      updateButton.addEventListener("click", () => {
        const nextName = inputs[0].value.trim();
        const nextZone = inputs[1].value.trim();
        if (!nextName || !TimeUtils.isValidZone(nextZone)) return;
        State.customCities = State.customCities.map((existing) =>
          existing.id === city.id
            ? {
              ...existing,
              name: nextName,
              zone: nextZone,
              x: MathUtils.clamp(Number(inputs[2].value), 0, 100),
              y: MathUtils.clamp(Number(inputs[3].value), 0, 100)
            }
            : existing
        );
        State.saveCustomCities();
        this.renderCustomCityEditor();
        this.render();
      });

      deleteButton.addEventListener("click", () => {
        State.customCities = State.customCities.filter((existing) => existing.id !== city.id);
        State.selectedIds = State.selectedIds.filter((selectedId) => selectedId !== city.id);
        State.saveCustomCities();
        State.saveSelection();
        this.renderCustomCityEditor();
        this.render();
      });

      DOM.customCityList.append(item);
    });
  },

  populatePeriodSelectors() {
    document.querySelectorAll(".period-start, .period-end").forEach((select) => {
      select.innerHTML = "";
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = String(h).padStart(2, "0");
        select.appendChild(opt);
      }
    });
  },

  renderPeriodSettings() {
    State.timePeriods.forEach((period, idx) => {
      const row = document.querySelector(`.period-setting-row[data-period="${idx}"]`);
      if (!row) return;
      row.querySelector(".period-start").value = period.start;
      row.querySelector(".period-end").value = period.end;
      row.querySelector(".period-bg-color").value = period.color;
      row.querySelector(".period-text-color").value = period.fontColor;
    });
  },

  renderTimezoneLines() {
    if (!DOM.timezoneLines) return;
    DOM.timezoneLines.innerHTML = "";
    DOM.timezoneLines.style.backgroundImage = "none";

    for (let offset = -12; offset <= 12; offset++) {
      const lng = offset * 15 - 7.5;
      const x = MathUtils.clamp(MapUtils.getLongitudeX(lng), 0, 100);

      const line = document.createElement("div");
      line.style.position = "absolute";
      line.style.left = `${x}%`;
      line.style.top = "0";
      line.style.bottom = "0";
      line.style.width = "1px";
      line.style.backgroundColor = "rgba(8, 74, 96, 0.18)";
      DOM.timezoneLines.append(line);
    }
  },

  /** Returns the SVG point array for the day-night boundary at a given hour offset from now. */
  _calcNightBoundaryPoints(offsetHours) {
    const time = new Date();
    time.setTime(time.getTime() + offsetHours * 60 * 60 * 1000);

    const DECLINATION_DEG = 35.0;
    const tanDec = Math.tan(DECLINATION_DEG * Math.PI / 180);
    const Y_SHIFT = 10;

    const subsolarLng = -(time.getUTCHours() + time.getUTCMinutes() / 60 - 12) * 15;

    const points = [];
    for (let x = 0; x <= 100; x += 2) {
      const lng = MapUtils.getXLongitude(x);
      const lat = Math.atan(-Math.cos((lng - subsolarLng) * Math.PI / 180) / tanDec)
        * 180 / Math.PI + Y_SHIFT;
      const { x: px, y: py } = MapUtils.mapPosition({ lng, lat });
      points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return points;
  },

  renderDayNight(offsetHours = 0) {
    if (!DOM.nightPath) return;

    if (DOM.dayNightOverlay) {
      DOM.dayNightOverlay.style.transform = `translateY(${State.mapSettings.mapYOffset || 0}px)`;
    }

    // Filled night area — follows the scrub line offset
    const pts = this._calcNightBoundaryPoints(offsetHours);
    DOM.nightPath.setAttribute("d", `M 0,100 L ${pts.join(" L ")} L 100,100 Z`);

    // Static reference curve — always at the true "now" position (offset = 0)
    if (DOM.nightPathRef) {
      const refPts = this._calcNightBoundaryPoints(0);
      DOM.nightPathRef.setAttribute("d", `M ${refPts.join(" L ")}`);
    }
  },


  render() {
    State.makeBaseHours();
    this.renderNowText();
    this.renderMap();
    this.renderTimezoneLines();
    this.renderRows();
    this.renderCustomCityEditor();
    this.renderPeriodSettings();
    // Render lines after layout is established
    this.renderNowLine();
    this.renderScrubLine();
    this.renderDayNight(State.selectedOffsetHours || 0);
  },

  renderNowLine() {
    if (!DOM.nowLine) return;
    const fraction = TimelineUtils.getNowFraction();
    const left = TimelineUtils.fractionToLeft(fraction);
    if (left === 0) {
      DOM.nowLine.style.display = "none";
      return;
    }
    DOM.nowLine.style.display = "";
    DOM.nowLine.style.left = `${left}px`;
  },

  renderScrubLine() {
    if (!DOM.scrubLine || !DOM.scrubHandle) return;
    
    const isSnapped = (State.scrubFraction === null);
    let fraction = State.scrubFraction;
    if (isSnapped) {
      fraction = TimelineUtils.getNowFraction();
    }
    
    if (DOM.scrubResetBtn) {
      if (isSnapped) {
        DOM.scrubResetBtn.classList.remove("is-visible");
      } else {
        DOM.scrubResetBtn.classList.add("is-visible");
      }
    }
    
    const left = TimelineUtils.fractionToLeft(fraction);
    if (left === 0) {
      DOM.scrubLine.style.display = "none";
      DOM.scrubHandle.style.display = "none";
      if (DOM.scrubResetBtn) {
        DOM.scrubResetBtn.style.display = "none";
      }
      return;
    }
    DOM.scrubLine.style.display = "";
    DOM.scrubHandle.style.display = "";
    DOM.scrubLine.style.left = `${left}px`;
    DOM.scrubHandle.style.left = `${left}px`;
    
    if (DOM.scrubResetBtn) {
      DOM.scrubResetBtn.style.display = "";
      DOM.scrubResetBtn.style.left = `${left}px`;
    }
    
    // Compute day-night offset relative to real now
    const nowFraction = TimelineUtils.getNowFraction();
    State.selectedOffsetHours = (fraction - nowFraction) * 24;
  }
};


// ==========================================
// 6. EVENT CONTROLLERS
// ==========================================
const AppController = {
  updateMapSetting(key, value) {
    const input = document.querySelector(`[data-setting="${key}"]`);
    if (!input) return;

    const min = Number(input.min);
    const max = Number(input.max);
    const next = MathUtils.clamp(Number(value), min, max);
    State.mapSettings = {
      ...State.mapSettings,
      [key]: key.endsWith("Scale") ? Number(next.toFixed(2)) : Number(next.toFixed(1))
    };
    State.saveMapSettings();
    Renderer.renderSettingsControls();
    Renderer.renderMap();
  },

  addGeneratedTimezone(offset, clickX, clickY) {
    const offsetText = offset >= 0 ? `+${offset}` : `${offset}`;
    const name = `UTC${offsetText}`;

    let zone;
    if (offset === 0) {
      zone = "Etc/GMT";
    } else if (offset > 0) {
      zone = `Etc/GMT-${offset}`;
    } else {
      zone = `Etc/GMT+${Math.abs(offset)}`;
    }

    const x = MathUtils.clamp(50 + (clickX - 50 - State.mapSettings.lngOffset) / State.mapSettings.widthScale, 0, 100);
    const y = MathUtils.clamp(50 + (clickY - 50 + State.mapSettings.latOffset) / State.mapSettings.heightScale, 0, 100);

    const newCity = {
      id: `custom-utc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      zone,
      x,
      y
    };

    State.customCities = [...State.customCities, newCity];
    State.saveCustomCities();
    State.toggleCity(newCity.id);
    Renderer.renderCustomCityEditor();
  },

  wireMapSettings() {
    DOM.settingsButton.addEventListener("click", () => {
      const isOpen = DOM.settingsPanel.hidden;
      DOM.settingsPanel.hidden = !isOpen;
      DOM.settingsButton.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll("[data-setting]").forEach((input) => {
      input.addEventListener("input", () => {
        this.updateMapSetting(input.dataset.setting, input.value);
      });
    });

    document.querySelectorAll("[data-adjust]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.adjust;
        const delta = Number(button.dataset.delta);
        this.updateMapSetting(key, State.mapSettings[key] + delta);
      });
    });

    DOM.resetMapButton.addEventListener("click", () => {
      State.mapSettings = { ...CONFIG.defaultMapSettings };
      State.saveMapSettings();
      Renderer.renderSettingsControls();
      Renderer.renderMap();
      Renderer.render();
    });

    if (DOM.resetPeriodsButton) {
      DOM.resetPeriodsButton.addEventListener("click", () => {
        State.timePeriods = JSON.parse(JSON.stringify(CONFIG.defaultTimePeriods));
        State.saveTimePeriods();
        Renderer.renderPeriodSettings();
        Renderer.render();
      });
    }
  },

  fetchCityResults(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    return fetch(url).then((res) => res.json());
  },

  fillCityForm(result) {
    DOM.customCityName.value = result.name;
    DOM.customCityZone.value = result.timezone || "";
    const cx = 0.2816 * result.longitude + 46.2357;
    const cy = -0.5257 * result.latitude + 63.3239;
    DOM.customCityX.value = cx.toFixed(1);
    DOM.customCityY.value = cy.toFixed(1);
  },

  wireCitySearch() {
    if (!DOM.searchCityButton) return;

    document.addEventListener("click", (e) => {
      if (DOM.searchSuggestions && !DOM.searchSuggestions.contains(e.target) && e.target !== DOM.customCityName && e.target !== DOM.searchCityButton) {
        DOM.searchSuggestions.hidden = true;
      }
    });

    if (DOM.customCityName) {
      DOM.customCityName.addEventListener("input", () => {
        if (DOM.searchSuggestions) {
          DOM.searchSuggestions.hidden = true;
        }
      });
    }

    DOM.searchCityButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const query = DOM.customCityName.value.trim();
      if (!query) return;

      DOM.searchCityButton.textContent = "⏳";
      DOM.searchCityButton.style.pointerEvents = "none";
      DOM.searchSuggestions.hidden = true;
      DOM.searchSuggestions.innerHTML = "";

      this.fetchCityResults(query)
        .then((data) => {
          if (data && data.results && data.results.length > 0) {
            if (data.results.length === 1) {
              this.fillCityForm(data.results[0]);
            } else {
              DOM.searchSuggestions.innerHTML = "";
              data.results.forEach((result) => {
                const item = document.createElement("div");
                item.className = "suggestion-item";

                const subtitleParts = [];
                if (result.country) subtitleParts.push(result.country);
                if (result.admin1) subtitleParts.push(result.admin1);
                const subtitleText = subtitleParts.length > 0 ? ` (${subtitleParts.join(", ")})` : "";

                item.innerHTML = `
                    <div class="suggestion-title">${result.name}${subtitleText}</div>
                    <div class="suggestion-subtitle">${result.timezone || ""}</div>
                  `;

                item.addEventListener("click", (evt) => {
                  evt.stopPropagation();
                  this.fillCityForm(result);
                  DOM.searchSuggestions.hidden = true;
                });
                DOM.searchSuggestions.append(item);
              });
              DOM.searchSuggestions.hidden = false;
            }
          } else {
            alert(I18nUtils.getTranslation("cityNotFound") || "City not found");
          }
        })
        .catch((err) => {
          console.error(err);
          alert("Network error. Please try again.");
        })
        .finally(() => {
          DOM.searchCityButton.textContent = "🔍";
          DOM.searchCityButton.style.pointerEvents = "auto";
        });
    });
  },

  wireCustomCityForm() {
    DOM.addCustomCityButton.addEventListener("click", () => {
      const name = DOM.customCityName.value.trim();
      const zone = DOM.customCityZone.value.trim();
      const x = Number(DOM.customCityX.value);
      const y = Number(DOM.customCityY.value);
      if (!name || !zone || !TimeUtils.isValidZone(zone)) return;

      const newCity = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        zone,
        x: MathUtils.clamp(x, 0, 100),
        y: MathUtils.clamp(y, 0, 100)
      };

      State.customCities = [
        ...State.customCities,
        newCity
      ];
      State.saveCustomCities();
      DOM.customCityName.value = "";
      DOM.customCityZone.value = "";
      State.toggleCity(newCity.id);
      Renderer.renderCustomCityEditor();
    });
  },

  wireSettings() {
    this.wireMapSettings();
    this.wireCitySearch();
    this.wireCustomCityForm();
  },

  wireScrubLine() {
    if (!DOM.scrubHandle || !DOM.scrubLine) return;
    let isDragging = false;

    // Double-click: reset scrub line to now position
    DOM.scrubHandle.addEventListener("dblclick", (e) => {
      e.preventDefault();
      State.scrubFraction = null;   // null = snap to now
      Renderer.renderScrubLine();
      Renderer.renderDayNight(State.selectedOffsetHours || 0);
    });

    if (DOM.scrubResetBtn) {
      DOM.scrubResetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        State.scrubFraction = null;   // null = snap to now
        Renderer.renderScrubLine();
        Renderer.renderDayNight(State.selectedOffsetHours || 0);
      });
      DOM.scrubResetBtn.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
    }

    // Mousedown: start drag
    DOM.scrubHandle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;   // left button only
      isDragging = true;
      DOM.scrubLine.classList.add("is-dragging");
      DOM.scrubHandle.classList.add("is-dragging");
      e.preventDefault();
    });

    // Mousemove on document: update position while dragging
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const panelRect = DOM.timelinePanel.getBoundingClientRect();
      const pxLeft = e.clientX - panelRect.left;
      State.scrubFraction = TimelineUtils.leftToFraction(pxLeft);

      const left = TimelineUtils.fractionToLeft(State.scrubFraction);
      DOM.scrubLine.style.left = `${left}px`;
      DOM.scrubHandle.style.left = `${left}px`;
      if (DOM.scrubResetBtn) {
        DOM.scrubResetBtn.style.left = `${left}px`;
        DOM.scrubResetBtn.classList.add("is-visible");
      }

      // Live-update day-night overlay
      const nowFraction = TimelineUtils.getNowFraction();
      State.selectedOffsetHours = (State.scrubFraction - nowFraction) * 24;
      Renderer.renderDayNight(State.selectedOffsetHours);
    });

    // Mouseup: end drag
    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      DOM.scrubLine.classList.remove("is-dragging");
      DOM.scrubHandle.classList.remove("is-dragging");
    });
  },

  wireMapTimezoneHover() {
    if (DOM.mapShell && DOM.timezoneHoverBar) {
      DOM.mapShell.addEventListener("mousemove", (e) => {
        const rect = DOM.mapShell.getBoundingClientRect();
        const relativeX = (e.clientX - rect.left) / rect.width;
        if (relativeX >= 0 && relativeX <= 1) {
          const x = relativeX * 100;
          const lng = MapUtils.getXLongitude(x);
          const offset = MathUtils.clamp(Math.round(lng / 15), -12, 12);

          const x_left = MathUtils.clamp(MapUtils.getLongitudeX(offset * 15 - 7.5), 0, 100);
          const x_right = MathUtils.clamp(MapUtils.getLongitudeX(offset * 15 + 7.5), 0, 100);

          DOM.timezoneHoverBar.style.left = `${x_left}%`;
          DOM.timezoneHoverBar.style.width = `${x_right - x_left}%`;
          DOM.timezoneHoverBar.hidden = false;
        } else {
          DOM.timezoneHoverBar.hidden = true;
        }
      });

      DOM.mapShell.addEventListener("mouseleave", () => {
        DOM.timezoneHoverBar.hidden = true;
      });
    }

    if (DOM.cityLayer) {
      DOM.cityLayer.addEventListener("click", (e) => {
        if (e.target === DOM.cityLayer) {
          const rect = DOM.cityLayer.getBoundingClientRect();
          const clickX = ((e.clientX - rect.left) / rect.width) * 100;
          const clickY = ((e.clientY - rect.top) / rect.height) * 100;

          const lng = MapUtils.getXLongitude(clickX);
          const offset = MathUtils.clamp(Math.round(lng / 15), -12, 12);

          this.addGeneratedTimezone(offset, clickX, clickY);
        }
      });
    }
  },

  wirePeriodSettings() {
    State.timePeriods.forEach((period, idx) => {
      const row = document.querySelector(`.period-setting-row[data-period="${idx}"]`);
      if (!row) return;

      row.querySelector(".period-start").addEventListener("change", (e) => {
        State.timePeriods[idx].start = Number(e.target.value);
        State.saveTimePeriods();
        Renderer.render();
      });

      row.querySelector(".period-end").addEventListener("change", (e) => {
        State.timePeriods[idx].end = Number(e.target.value);
        State.saveTimePeriods();
        Renderer.render();
      });

      row.querySelector(".period-bg-color").addEventListener("change", (e) => {
        State.timePeriods[idx].color = e.target.value;
        State.saveTimePeriods();
        Renderer.render();
      });

      row.querySelector(".period-text-color").addEventListener("change", (e) => {
        State.timePeriods[idx].fontColor = e.target.value;
        State.saveTimePeriods();
        Renderer.render();
      });
    });
  },

  init() {
    State.init();

    this.wireSettings();
    this.wireScrubLine();
    this.wireMapTimezoneHover();
    Renderer.renderSettingsControls();

    DOM.langSelect.value = State.currentLang;
    DOM.langSelect.addEventListener("change", (e) => {
      State.saveLanguage(e.target.value);
      Renderer.applyLanguage();
      Renderer.render();
    });

    // Now-line reference mode toggle
    if (DOM.nowLineModeSelect) {
      DOM.nowLineModeSelect.value = State.nowLineMode;
      DOM.nowLineModeSelect.addEventListener("change", (e) => {
        State.saveNowLineMode(e.target.value);
        State.scrubFraction = null;   // reset scrub to new now position
        Renderer.render();
      });
    }

    DOM.resetButton.addEventListener("click", () => {
      State.selectedIds = [...CONFIG.defaultSelection];
      State.saveSelection();
      Renderer.render();
    });

    DOM.clearAllButton.addEventListener("click", () => {
      State.selectedIds = [];
      State.customCities = [];
      State.saveSelection();
      State.saveCustomCities();
      Renderer.render();
    });

    Renderer.populatePeriodSelectors();
    this.wirePeriodSettings();
    Renderer.applyLanguage();
    Renderer.render();

    setInterval(() => Renderer.render(), 60 * 1000);
  }
};

// ==========================================
// 7. INITIALIZATION
// ==========================================
AppController.init();
