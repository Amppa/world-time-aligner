/**
 * World Time Aligner - Application State Management Module
 */
import { CONFIG } from './config.js';
import { TimeUtils, MathUtils } from './utils.js';
import { Renderer } from './renderer.js';
import { cityCatalog } from '../cities.js';

export const State = {
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
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((item) => item !== id);
      if (id.startsWith("custom-")) {
        this.customCities = this.customCities.filter((city) => city.id !== id);
        this.saveCustomCities();
      }
    } else {
      this.selectedIds = [...this.selectedIds.slice(-(CONFIG.maxCities - 1)), id];
    }
    this.saveSelection();
    Renderer.render();
  }
};
