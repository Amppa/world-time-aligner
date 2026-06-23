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
    mapYOffset: 30,
    showNightArea: true,
    showHourLines: true
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
  currentCitiesList: document.querySelector("#currentCitiesList"),
  searchCityInput: document.querySelector("#searchCityInput"),
  searchCityBtn: document.querySelector("#searchCityBtn"),
  searchResultsList: document.querySelector("#searchResultsList"),
  langButtons: document.querySelectorAll(".lang-btn"),
  nowLineModeSelect: document.querySelector("#nowLineModeSelect"),
  mapImg: document.querySelector(".world-map"),
  mapShell: document.querySelector(".map-shell"),
  timezoneHoverBar: document.querySelector("#timezoneHoverBar"),
  hourLines: document.querySelector(".hour-lines"),
  nightAreaOverlay: document.querySelector("#nightAreaOverlay"),
  nightPath: document.querySelector("#nightPath"),
  nightPathRef: document.querySelector("#nightPathRef"),
  mapTimeline: document.querySelector("#mapTimeline")
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
    if (typeof zone !== "string") return "UTC";
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

    return "UTC";
  },

  isValidZone(zone) {
    if (typeof zone !== "string" || !zone.trim()) return false;
    const resolved = this.resolveZone(zone);
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: resolved }).format(new Date());
      return resolved !== "UTC" || zone.trim().toUpperCase() === "UTC";
    } catch {
      return false;
    }
  },

  formatTime(date, zone, options = {}) {
    try {
      const resolved = this.resolveZone(zone);
      const locale = State.currentLang === "zh" ? "zh-TW" : "en-US";
      return new Intl.DateTimeFormat(locale, {
        timeZone: resolved,
        hour: "2-digit",
        minute: options.withMinutes === false ? undefined : "2-digit",
        hour12: false,
        weekday: options.weekday ? "short" : undefined
      }).format(date);
    } catch {
      return "00:00";
    }
  },

  hourInZone(date, zone) {
    try {
      const resolved = this.resolveZone(zone);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: resolved,
        hour: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      const hourPart = parts.find((part) => part.type === "hour");
      return hourPart ? Number(hourPart.value) : date.getHours();
    } catch {
      return date.getHours();
    }
  },

  utcOffsetText(date, zone) {
    try {
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
    } catch {
      return "UTC+0";
    }
  },

  getOffsetMinutes(date, zone) {
    try {
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
    } catch {
      return 0;
    }
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
  }
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
    const screenPercentX = MathUtils.clamp(50 + (cx - 50) * State.mapSettings.widthScale + State.mapSettings.lngOffset, 0, 100);
    const screenPercentY = MathUtils.clamp(50 + (cy - 50) * State.mapSettings.heightScale - State.mapSettings.latOffset, 0, 100);
    return {
      x: screenPercentX,
      y: screenPercentY
    };
  },

  getLongitudeX(lng) {
    const cx = 0.2816 * lng + 46.2357;
    return 50 + (cx - 50) * State.mapSettings.widthScale + State.mapSettings.lngOffset;
  },

  getXLongitude(x) {
    const cx = 50 + (x - 50 - State.mapSettings.lngOffset) / State.mapSettings.widthScale;
    return (cx - 46.2357) / 0.2816;
  },

  getCityCoordinates(city) {
    let lng = city.lng;
    let lat = city.lat;
    if (typeof lng !== "number" || typeof lat !== "number") {
      // Reverse calculate from x, y
      lng = (city.x - 46.2357) / 0.2816;
      lat = (city.y - 63.3239) / -0.5257;
    }
    const lngText = lng >= 0 ? `${lng.toFixed(1)}°E` : `${Math.abs(lng).toFixed(1)}°W`;
    const latText = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
    return `${lngText}, ${latText}`;
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
  draggingId: null,

  init() {
    this.currentLang = this.loadLanguage();
    this.timePeriods = this.loadTimePeriods();
    this.mapSettings = this.loadMapSettings();
    this.customCities = this.loadCustomCities();
    this.selectedIds = this.loadSelection();
    this.nowLineMode = this.loadNowLineMode();
    this.selectedOffsetHours = null;
    this.scrubFraction = null;
    this.draggingId = null;
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
          mapYOffset: Number.isFinite(Number(saved.mapYOffset)) ? Number(saved.mapYOffset) : CONFIG.defaultMapSettings.mapYOffset,
          showNightArea: saved.showNightArea !== undefined ? !!saved.showNightArea : CONFIG.defaultMapSettings.showNightArea,
          showHourLines: saved.showHourLines !== undefined ? !!saved.showHourLines : CONFIG.defaultMapSettings.showHourLines
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
            y: Number.isFinite(Number(city.y)) ? Number(city.y) : 50,
            lng: Number.isFinite(Number(city.lng)) ? Number(city.lng) : undefined,
            lat: Number.isFinite(Number(city.lat)) ? Number(city.lat) : undefined
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
      if (input.type === "checkbox") {
        input.checked = !!State.mapSettings[key];
      } else {
        input.value = String(State.mapSettings[key]);
      }
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

  renderCurrentCitiesList() {
    if (!DOM.currentCitiesList) return;
    DOM.currentCitiesList.innerHTML = "";

    const supportedZones = (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function")
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC", "Asia/Taipei", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];

    const uniqueZonesSet = new Set(supportedZones);
    State.selectedIds.forEach((id) => {
      const city = State.findCity(id);
      if (city && city.zone) {
        uniqueZonesSet.add(city.zone);
      }
    });

    const now = new Date();
    const zoneDetails = Array.from(uniqueZonesSet).map((zone) => {
      const offsetMins = TimeUtils.getOffsetMinutes(now, zone);
      const sign = offsetMins >= 0 ? "+" : "-";
      const absMins = Math.abs(offsetMins);
      const hours = Math.floor(absMins / 60);
      const mins = absMins % 60;
      const offsetStr = `UTC${sign}${hours}${mins > 0 ? ":" + String(mins).padStart(2, "0") : ""}`;
      return {
        zone,
        offsetMins,
        label: `${zone} (${offsetStr})`
      };
    });

    zoneDetails.sort((a, b) => {
      if (a.offsetMins !== b.offsetMins) {
        return a.offsetMins - b.offsetMins;
      }
      return a.zone.localeCompare(b.zone);
    });

    State.selectedIds.forEach((id) => {
      const city = State.findCity(id);
      if (!city) return;

      const cityName = I18nUtils.getCityName(city);
      let lng = city.lng;
      let lat = city.lat;
      if (typeof lng !== "number" || typeof lat !== "number") {
        lng = (city.x - 46.2357) / 0.2816;
        lat = (city.y - 63.3239) / -0.5257;
      }

      const card = document.createElement("div");
      card.className = "current-city-card";
      card.setAttribute("draggable", "false");
      card.dataset.id = id;

      const currentZone = city.zone || "UTC";
      let timezoneOptions = "";
      zoneDetails.forEach((detail) => {
        const selected = detail.zone === currentZone ? " selected" : "";
        timezoneOptions += `<option value="${detail.zone}"${selected}>${detail.label}</option>`;
      });

      card.innerHTML = `
        <div class="drag-handle">⋮⋮</div>
        <input class="city-name-input" type="text" value="${cityName.replaceAll('"', "&quot;")}" placeholder="Name">
        <select class="city-zone-select">
          ${timezoneOptions}
        </select>
        <input class="city-lng-input" type="number" step="any" value="${lng.toFixed(2)}" placeholder="Lng">
        <input class="city-lat-input" type="number" step="any" value="${lat.toFixed(2)}" placeholder="Lat">
        <button type="button" class="update-city-card-btn">${I18nUtils.getTranslation("updateBtn") || "Update"}</button>
        <button type="button" class="remove-city-card-btn" aria-label="${I18nUtils.getTranslation("removeCity", { name: cityName })}">×</button>
      `;

      const nameInput = card.querySelector(".city-name-input");
      const zoneSelect = card.querySelector(".city-zone-select");
      const lngInput = card.querySelector(".city-lng-input");
      const latInput = card.querySelector(".city-lat-input");
      const updateBtn = card.querySelector(".update-city-card-btn");
      const removeBtn = card.querySelector(".remove-city-card-btn");

      const dragHandle = card.querySelector(".drag-handle");
      dragHandle.addEventListener("mouseenter", () => {
        card.setAttribute("draggable", "true");
      });
      dragHandle.addEventListener("mouseleave", () => {
        card.setAttribute("draggable", "false");
      });

      card.addEventListener("dragstart", (e) => {
        State.draggingId = id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        card.classList.add("is-dragging");
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });

      card.addEventListener("dragenter", (e) => {
        e.preventDefault();
        card.classList.add("drag-over");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        document.querySelectorAll(".current-city-card").forEach(c => c.classList.remove("drag-over"));
        State.draggingId = null;
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("drag-over");
        const draggedId = State.draggingId;
        if (draggedId && draggedId !== id) {
          const oldIndex = State.selectedIds.indexOf(draggedId);
          const newIndex = State.selectedIds.indexOf(id);
          if (oldIndex !== -1 && newIndex !== -1) {
            const list = [...State.selectedIds];
            list.splice(oldIndex, 1);
            list.splice(newIndex, 0, draggedId);
            State.selectedIds = list;
            State.saveSelection();
            Renderer.render();
          }
        }
        State.draggingId = null;
      });

      updateBtn.addEventListener("click", () => {
        const nextName = nameInput.value.trim();
        const nextZone = zoneSelect.value.trim();
        const nextLng = Number(lngInput.value);
        const nextLat = Number(latInput.value);

        if (!nextName || !nextZone || !TimeUtils.isValidZone(nextZone) || isNaN(nextLng) || isNaN(nextLat)) {
          alert("Invalid input. Please verify name, timezone, and coordinates.");
          return;
        }

        const cx = 0.2816 * nextLng + 46.2357;
        const cy = -0.5257 * nextLat + 63.3239;
        const x = MathUtils.clamp(cx, 0, 100);
        const y = MathUtils.clamp(cy, 0, 100);

        let targetId = city.id;
        let isNewCustom = false;
        if (!targetId.startsWith("custom-")) {
          targetId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          isNewCustom = true;
        }

        const updatedCity = {
          id: targetId,
          name: nextName,
          zone: nextZone,
          x: x,
          y: y,
          lng: nextLng,
          lat: nextLat
        };

        if (isNewCustom) {
          State.customCities = [...State.customCities, updatedCity];
          State.selectedIds = State.selectedIds.map(selectedId => selectedId === city.id ? targetId : selectedId);
        } else {
          State.customCities = State.customCities.map(existing => existing.id === city.id ? updatedCity : existing);
        }

        State.saveCustomCities();
        State.saveSelection();
        Renderer.render();
      });

      removeBtn.addEventListener("click", () => {
        State.toggleCity(city.id);
      });

      DOM.currentCitiesList.append(card);
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

  renderHourLines(offsetHours = 0) {
    if (!DOM.hourLines) return;
    DOM.hourLines.innerHTML = "";
    DOM.hourLines.style.backgroundImage = "none";

    const time = new Date();
    time.setTime(time.getTime() + offsetHours * 60 * 60 * 1000);

    const subsolarLng = -(time.getUTCHours() + time.getUTCMinutes() / 60 - 12) * 15;
    const centerLng = MapUtils.getXLongitude(50);

    for (let h = 0; h < 24; h += 2) {
      const baseLng = subsolarLng + (h - 12) * 15;
      let diff = baseLng - centerLng;
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      const lng = centerLng + diff;

      const x = MathUtils.clamp(MapUtils.getLongitudeX(lng), 0, 100);

      const line = document.createElement("div");
      line.style.position = "absolute";
      line.style.left = `${x}%`;
      line.style.top = "0";
      line.style.bottom = "0";
      line.style.width = "1px";
      line.style.backgroundColor = "rgba(8, 74, 96, 0.18)";
      DOM.hourLines.append(line);
    }
  },

  /** Returns the SVG point array for the night area boundary at a given hour offset from now. */
  _calcNightAreaBoundaryPoints(offsetHours) {
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

  renderMapTimeline(offsetHours = 0) {
    if (!DOM.mapTimeline) return;
    DOM.mapTimeline.innerHTML = "";

    const time = new Date();
    time.setTime(time.getTime() + offsetHours * 60 * 60 * 1000);

    const subsolarLng = -(time.getUTCHours() + time.getUTCMinutes() / 60 - 12) * 15;
    const centerLng = MapUtils.getXLongitude(50);

    for (let h = 0; h < 24; h += 2) {
      const baseLng = subsolarLng + (h - 12) * 15;
      let diff = baseLng - centerLng;
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      const lng = centerLng + diff;

      const x = MapUtils.getLongitudeX(lng);
      if (x >= 0 && x <= 100) {
        const tick = document.createElement("div");
        tick.className = "map-timeline-tick";
        tick.style.left = `${x}%`;

        const label = document.createElement("div");
        label.className = "map-timeline-label";
        label.style.left = `${x}%`;
        label.textContent = `${String(h).padStart(2, "0")}:00`;

        DOM.mapTimeline.append(tick, label);
      }
    }
  },

  renderNightArea(offsetHours = 0) {
    if (!DOM.nightPath) return;

    this.renderMapTimeline(offsetHours);
    this.renderHourLines(offsetHours);

    if (DOM.nightAreaOverlay) {
      DOM.nightAreaOverlay.style.transform = `translateY(${State.mapSettings.mapYOffset || 0}px)`;
    }

    // Filled night area — follows the scrub line offset
    const pts = this._calcNightAreaBoundaryPoints(offsetHours);
    DOM.nightPath.setAttribute("d", `M 0,100 L ${pts.join(" L ")} L 100,100 Z`);

    // Static reference curve — always at the true "now" position (offset = 0)
    if (DOM.nightPathRef) {
      const refPts = this._calcNightAreaBoundaryPoints(0);
      DOM.nightPathRef.setAttribute("d", `M ${refPts.join(" L ")}`);
    }
  },


  applyVisibilitySettings() {
    if (DOM.nightAreaOverlay) {
      DOM.nightAreaOverlay.style.display = State.mapSettings.showNightArea ? "" : "none";
    }
    if (DOM.hourLines) {
      DOM.hourLines.style.display = State.mapSettings.showHourLines ? "" : "none";
    }
  },

  render() {
    State.makeBaseHours();
    this.renderNowText();
    this.renderMap();
    this.renderRows();
    this.renderCurrentCitiesList();
    this.renderPeriodSettings();
    // Render lines after layout is established
    this.renderNowLine();
    this.renderScrubLine();
    this.renderNightArea(State.selectedOffsetHours || 0);
    this.applyVisibilitySettings();
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

    // Compute night area offset relative to real now
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
  },

  wireMapSettings() {
    DOM.settingsButton.addEventListener("click", () => {
      const isOpen = DOM.settingsPanel.hidden;
      DOM.settingsPanel.hidden = !isOpen;
      DOM.settingsButton.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll("[data-setting]:not([type='checkbox'])").forEach((input) => {
      input.addEventListener("input", () => {
        this.updateMapSetting(input.dataset.setting, input.value);
      });
    });

    document.querySelectorAll("input[type='checkbox'][data-setting]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const key = checkbox.dataset.setting;
        State.mapSettings[key] = checkbox.checked;
        State.saveMapSettings();
        Renderer.applyVisibilitySettings();
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

  wireCitySearch() {
    if (!DOM.searchCityBtn) return;

    document.addEventListener("click", (e) => {
      if (DOM.searchResultsList && !DOM.searchResultsList.contains(e.target) && e.target !== DOM.searchCityInput && e.target !== DOM.searchCityBtn) {
        DOM.searchResultsList.hidden = true;
      }
    });

    const triggerSearch = () => {
      const query = DOM.searchCityInput.value.trim();
      if (!query) return;

      DOM.searchCityBtn.textContent = "⏳";
      DOM.searchCityBtn.style.pointerEvents = "none";
      DOM.searchResultsList.hidden = true;
      DOM.searchResultsList.innerHTML = "";

      this.fetchCityResults(query)
        .then((data) => {
          if (data && data.results && data.results.length > 0) {
            DOM.searchResultsList.innerHTML = "";
            data.results.forEach((result) => {
              const card = document.createElement("div");
              card.className = "search-result-card";

              const locationParts = [];
              if (result.country) locationParts.push(result.country);
              if (result.admin1) locationParts.push(result.admin1);
              const subtitleText = locationParts.length > 0 ? ` (${locationParts.join(", ")})` : "";

              const lng = result.longitude || 0;
              const lat = result.latitude || 0;

              card.innerHTML = `
                <div class="search-result-info">
                  <div class="search-result-name-row">
                    <span class="search-result-name">${result.name}</span>
                    <span class="search-result-country">${subtitleText}</span>
                  </div>
                  <div class="search-result-details">${result.timezone || "UTC"} (Lng: ${lng.toFixed(1)}, Lat: ${lat.toFixed(1)})</div>
                </div>
              `;

              card.addEventListener("click", (evt) => {
                evt.stopPropagation();
                
                const cx = 0.2816 * lng + 46.2357;
                const cy = -0.5257 * lat + 63.3239;
                const newCity = {
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  name: result.name,
                  zone: result.timezone || "UTC",
                  x: MathUtils.clamp(cx, 0, 100),
                  y: MathUtils.clamp(cy, 0, 100),
                  lng: lng,
                  lat: lat
                };

                State.customCities = [...State.customCities, newCity];
                State.saveCustomCities();
                State.toggleCity(newCity.id);

                DOM.searchCityInput.value = "";
                DOM.searchResultsList.hidden = true;
                DOM.searchResultsList.innerHTML = "";
              });
              
              DOM.searchResultsList.append(card);
            });
            DOM.searchResultsList.hidden = false;
          } else {
            alert(I18nUtils.getTranslation("cityNotFound") || "City not found");
          }
        })
        .catch((err) => {
          console.error(err);
          alert("Network error. Please try again.");
        })
        .finally(() => {
          DOM.searchCityBtn.textContent = I18nUtils.getTranslation("searchBtn") || "Search";
          DOM.searchCityBtn.style.pointerEvents = "auto";
        });
    };

    DOM.searchCityBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerSearch();
    });

    DOM.searchCityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        triggerSearch();
      }
    });
  },

  wireSettings() {
    this.wireMapSettings();
    this.wireCitySearch();
  },

  wireScrubLine() {
    if (!DOM.scrubHandle || !DOM.scrubLine) return;
    let isDragging = false;

    // Double-click: reset scrub line to now position
    DOM.scrubHandle.addEventListener("dblclick", (e) => {
      e.preventDefault();
      State.scrubFraction = null;   // null = snap to now
      Renderer.renderScrubLine();
      Renderer.renderNightArea(State.selectedOffsetHours || 0);
    });

    if (DOM.scrubResetBtn) {
      DOM.scrubResetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        State.scrubFraction = null;   // null = snap to now
        Renderer.renderScrubLine();
        Renderer.renderNightArea(State.selectedOffsetHours || 0);
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

      // Live-update night area overlay
      const nowFraction = TimelineUtils.getNowFraction();
      State.selectedOffsetHours = (State.scrubFraction - nowFraction) * 24;
      Renderer.renderNightArea(State.selectedOffsetHours);
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

          const time = new Date();
          const offsetHours = State.selectedOffsetHours || 0;
          time.setTime(time.getTime() + offsetHours * 60 * 60 * 1000);
          const subsolarLng = -(time.getUTCHours() + time.getUTCMinutes() / 60 - 12) * 15;

          const k = Math.round((lng - subsolarLng) / 15);

          const x_left = MathUtils.clamp(MapUtils.getLongitudeX(subsolarLng + (k - 0.5) * 15), 0, 100);
          const x_right = MathUtils.clamp(MapUtils.getLongitudeX(subsolarLng + (k + 0.5) * 15), 0, 100);

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

    DOM.langButtons.forEach((btn) => {
      if (btn.dataset.lang === State.currentLang) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
      btn.addEventListener("click", () => {
        DOM.langButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        State.saveLanguage(btn.dataset.lang);
        Renderer.applyLanguage();
        Renderer.render();
      });
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
