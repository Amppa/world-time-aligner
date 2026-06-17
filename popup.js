/**
 * World Time Aligner - Popup Logic
 */

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
  defaultSelection: ["taipei", "london", "new-york", "tokyo"],
  maxCities: 6,
  storageKey: "worldTimeAlignerCities",
  mapSettingsKey: "worldTimeAlignerMapSettings_v4",
  customCitiesKey: "worldTimeAlignerCustomCities",
  timePeriodsKey: "worldTimeAlignerTimePeriods",
  languageKey: "worldTimeAlignerLanguage",
  defaultMapSettings: {
    lngOffset: 1.0,
    latOffset: 20.7,
    widthScale: 1.0,
    heightScale: 1.39,
    mapYOffset: 30
  },
  defaultTimePeriods: [
    { name: "period1", start: 8, end: 17, color: "#f4d06f", fontColor: "#4c3d08" },
    { name: "period2", start: 18, end: 23, color: "#e59665", fontColor: "#3d2111" },
    { name: "period3", start: 0, end: 7, color: "#4a3125", fontColor: "#ffffff" }
  ]
};

// ==========================================
// 2. DOM ELEMENT CACHE
// ==========================================
const DOM = {
  cityLayer: document.querySelector("#cityLayer"),
  timelineRows: document.querySelector("#timelineRows"),
  hourHeader: document.querySelector("#hourHeader"),
  hoverGuide: document.querySelector("#hoverGuide"),
  timelinePanel: document.querySelector(".timeline-panel"),
  nowText: document.querySelector("#nowText"),
  resetButton: document.querySelector("#resetButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  resetMapButton: document.querySelector("#resetMapButton"),
  resetPeriodsButton: document.querySelector("#resetPeriodsButton"),
  customCityName: document.querySelector("#customCityName"),
  customCityZone: document.querySelector("#customCityZone"),
  customCityX: document.querySelector("#customCityX"),
  customCityY: document.querySelector("#customCityY"),
  addCustomCityButton: document.querySelector("#addCustomCityButton"),
  customCityList: document.querySelector("#customCityList"),
  langSelect: document.querySelector("#langSelect"),
  mapImg: document.querySelector(".world-map"),
  mapShell: document.querySelector(".map-shell"),
  timezoneHoverBar: document.querySelector("#timezoneHoverBar"),
  timezoneLines: document.querySelector(".time-zone-lines")
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
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
      return zone;
    } catch {}

    const prefixes = ["Asia", "Europe", "America", "Australia", "Africa", "Pacific", "Atlantic", "Indian"];
    for (const prefix of prefixes) {
      const candidate = `${prefix}/${zone}`;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
        return candidate;
      } catch {}
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

  getHourStyle(hour) {
    const period = State.timePeriods.find((p) => {
      if (p.start <= p.end) {
        return hour >= p.start && hour <= p.end;
      } else {
        return hour >= p.start || hour <= p.end;
      }
    });
    return period || State.timePeriods[2];
  },

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
  },

  timeTone(hour) {
    if (hour >= 8 && hour < 18) return "day";
    if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 22)) return "evening";
    return "night";
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
// 4. APPLICATION STATE MANAGEMENT
// ==========================================
const State = {
  selectedIds: [],
  customCities: [],
  mapSettings: {},
  timePeriods: [],
  currentLang: "zh",
  baseHours: [],

  init() {
    this.currentLang = this.loadLanguage();
    this.timePeriods = this.loadTimePeriods();
    this.mapSettings = this.loadMapSettings();
    this.customCities = this.loadCustomCities();
    this.selectedIds = this.loadSelection();
    this.makeBaseHours();
  },

  loadLanguage() {
    try {
      const saved = localStorage.getItem(CONFIG.languageKey);
      if (saved === "zh" || saved === "en") return saved;
    } catch {}
    const navLang = navigator.language || navigator.userLanguage || "zh";
    return navLang.toLowerCase().startsWith("en") ? "en" : "zh";
  },

  saveLanguage(lang) {
    this.currentLang = lang;
    try {
      localStorage.setItem(CONFIG.languageKey, lang);
    } catch {}
  },

  loadTimePeriods() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.timePeriodsKey));
      if (Array.isArray(saved) && saved.length === 3) {
        return saved;
      }
    } catch {}
    return JSON.parse(JSON.stringify(CONFIG.defaultTimePeriods));
  },

  saveTimePeriods() {
    try {
      localStorage.setItem(CONFIG.timePeriodsKey, JSON.stringify(this.timePeriods));
    } catch {}
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

  makeBaseHours() {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    this.baseHours = Array.from({ length: 24 }, (_, index) => {
      const date = new Date(start);
      date.setHours(start.getHours() + index);
      return date;
    });
  },

  toggleCity(id) {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((item) => item !== id);
    } else {
      this.selectedIds = [...this.selectedIds.slice(-(CONFIG.maxCities - 1)), id];
    }
    this.saveSelection();
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
    DOM.nowText.textContent = TimeUtils.formatTime(new Date(), localZone);
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
      const cityName = TimeUtils.getCityName(city);
      button.title = cityName;
      button.setAttribute("aria-label", TimeUtils.getTranslation("selectCity", { name: cityName }));
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

  renderHeader() {
    DOM.hourHeader.innerHTML = "";
    State.baseHours.forEach((date) => {
      const label = document.createElement("span");
      label.textContent = String(date.getHours()).padStart(2, "0");
      DOM.hourHeader.append(label);
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

      const cityName = TimeUtils.getCityName(city);
      const labelText = document.createElement("div");
      labelText.className = "city-label-text";
      const dstSuffix = TimeUtils.isCurrentlyDST(city.zone) ? ` ${TimeUtils.getTranslation("dstLabel")}` : "";
      labelText.innerHTML = `<span class="city-name">${cityName}</span><span class="city-time">${TimeUtils.utcOffsetText(new Date(), city.zone)} · ${TimeUtils.formatTime(new Date(), city.zone)}${dstSuffix}</span>`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-city-btn";
      removeBtn.textContent = "×";
      removeBtn.title = TimeUtils.getTranslation("removeCity", { name: cityName });
      removeBtn.setAttribute("aria-label", TimeUtils.getTranslation("removeCity", { name: cityName }));
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

        const styleInfo = TimeUtils.getHourStyle(cityHour);
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
        <button type="button">${TimeUtils.getTranslation("updateBtn")}</button>
        <button type="button">${TimeUtils.getTranslation("deleteBtn")}</button>
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

  render() {
    State.makeBaseHours();
    this.renderNowText();
    this.renderMap();
    this.renderTimezoneLines();
    this.renderHeader();
    this.renderRows();
    this.renderCustomCityEditor();
    this.renderPeriodSettings();
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

  wireSettings() {
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

    DOM.addCustomCityButton.addEventListener("click", () => {
      const name = DOM.customCityName.value.trim();
      const zone = DOM.customCityZone.value.trim();
      const x = Number(DOM.customCityX.value);
      const y = Number(DOM.customCityY.value);
      if (!name || !zone || !TimeUtils.isValidZone(zone)) return;

      State.customCities = [
        ...State.customCities,
        {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          zone,
          x: MathUtils.clamp(x, 0, 100),
          y: MathUtils.clamp(y, 0, 100)
        }
      ];
      State.saveCustomCities();
      DOM.customCityName.value = "";
      DOM.customCityZone.value = "";
      Renderer.renderCustomCityEditor();
      Renderer.render();
    });
  },

  updateHover(index) {
    const hourGrid = document.querySelector(".hours");
    if (!hourGrid) return;
    const gridRect = hourGrid.getBoundingClientRect();
    const panelRect = DOM.timelinePanel.getBoundingClientRect();
    const cellWidth = gridRect.width / 24;
    DOM.hoverGuide.style.left = `${gridRect.left - panelRect.left + cellWidth * index + cellWidth / 2}px`;
    DOM.timelinePanel.classList.add("is-hovering");
  },

  wireTimelineHover() {
    DOM.timelinePanel.addEventListener("mousemove", (event) => {
      const cell = event.target.closest(".hour-cell");
      if (!cell) return;
      this.updateHover(Number(cell.dataset.index));
    });

    DOM.timelinePanel.addEventListener("mouseleave", () => {
      DOM.timelinePanel.classList.remove("is-hovering");
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
    this.wireTimelineHover();
    this.wireMapTimezoneHover();
    Renderer.renderSettingsControls();

    DOM.langSelect.value = State.currentLang;
    DOM.langSelect.addEventListener("change", (e) => {
      State.saveLanguage(e.target.value);
      Renderer.applyLanguage();
      Renderer.render();
    });

    DOM.resetButton.addEventListener("click", () => {
      State.selectedIds = [...CONFIG.defaultSelection];
      State.saveSelection();
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
