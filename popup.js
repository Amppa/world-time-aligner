
const defaultSelection = ["taipei", "london", "new-york", "tokyo"];
const maxCities = 4;
const storageKey = "worldTimeAlignerCities";
const mapSettingsKey = "worldTimeAlignerMapSettings";
const customCitiesKey = "worldTimeAlignerCustomCities";
const defaultMapSettings = {
  lngOffset: 0,
  latOffset: 0,
  widthScale: 1,
  heightScale: 0.7
};

const cityLayer = document.querySelector("#cityLayer");
const timelineRows = document.querySelector("#timelineRows");
const hourHeader = document.querySelector("#hourHeader");
const hoverGuide = document.querySelector("#hoverGuide");
const timelinePanel = document.querySelector(".timeline-panel");
const nowText = document.querySelector("#nowText");
const resetButton = document.querySelector("#resetButton");
const settingsButton = document.querySelector("#settingsButton");
const settingsPanel = document.querySelector("#settingsPanel");
const resetMapButton = document.querySelector("#resetMapButton");
const customCityName = document.querySelector("#customCityName");
const customCityZone = document.querySelector("#customCityZone");
const customCityX = document.querySelector("#customCityX");
const customCityY = document.querySelector("#customCityY");
const addCustomCityButton = document.querySelector("#addCustomCityButton");
const customCityList = document.querySelector("#customCityList");
const langSelect = document.querySelector("#langSelect");

const defaultTimePeriods = [
  { name: "period1", start: 8, end: 17, color: "#f4d06f", fontColor: "#4c3d08" },
  { name: "period2", start: 18, end: 23, color: "#e59665", fontColor: "#3d2111" },
  { name: "period3", start: 0, end: 7, color: "#4a3125", fontColor: "#ffffff" }
];
const timePeriodsKey = "worldTimeAlignerTimePeriods";
let timePeriods = loadTimePeriods();

function loadTimePeriods() {
  try {
    const saved = JSON.parse(localStorage.getItem(timePeriodsKey));
    if (Array.isArray(saved) && saved.length === 3) {
      return saved;
    }
  } catch {}
  return JSON.parse(JSON.stringify(defaultTimePeriods));
}

function saveTimePeriods() {
  try {
    localStorage.setItem(timePeriodsKey, JSON.stringify(timePeriods));
  } catch {}
}

function getHourStyle(hour) {
  const period = timePeriods.find((p) => {
    if (p.start <= p.end) {
      return hour >= p.start && hour <= p.end;
    } else {
      return hour >= p.start || hour <= p.end;
    }
  });
  return period || timePeriods[2];
}

const languageKey = "worldTimeAlignerLanguage";
let currentLang = loadLanguage();

function loadLanguage() {
  try {
    const saved = localStorage.getItem(languageKey);
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  const navLang = navigator.language || navigator.userLanguage || "zh";
  return navLang.toLowerCase().startsWith("en") ? "en" : "zh";
}

function saveLanguage(lang) {
  try {
    localStorage.setItem(languageKey, lang);
  } catch {}
}

function getTranslation(key, params = {}) {
  let text = (typeof i18nTranslations !== "undefined" && i18nTranslations[currentLang]?.[key]) || "";
  for (const [pKey, pVal] of Object.entries(params)) {
    text = text.replace(`{${pKey}}`, pVal);
  }
  return text;
}

function getCityName(city) {
  if (!city) return "";
  if (city.id.startsWith("custom-")) {
    return city.name;
  }
  return (typeof i18nCityNames !== "undefined" && i18nCityNames[currentLang]?.[city.id]) || city.id;
}

function resolveZone(zone) {
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
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((elem) => {
    const key = elem.dataset.i18n;
    if (i18nTranslations[currentLang]?.[key]) {
      elem.textContent = i18nTranslations[currentLang][key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((elem) => {
    const key = elem.dataset.i18nPlaceholder;
    if (i18nTranslations[currentLang]?.[key]) {
      elem.placeholder = i18nTranslations[currentLang][key];
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach((elem) => {
    const key = elem.dataset.i18nTitle;
    if (i18nTranslations[currentLang]?.[key]) {
      elem.title = i18nTranslations[currentLang][key];
    }
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((elem) => {
    const key = elem.dataset.i18nAriaLabel;
    if (i18nTranslations[currentLang]?.[key]) {
      elem.setAttribute("aria-label", i18nTranslations[currentLang][key]);
    }
  });
}

let selectedIds = loadSelection();
let mapSettings = loadMapSettings();
let customCities = loadCustomCities();
let baseHours = [];

function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length) {
      return saved.filter((id) => cityCatalog.some((city) => city.id === id)).slice(0, maxCities);
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
  return [...defaultSelection];
}

function saveSelection() {
  localStorage.setItem(storageKey, JSON.stringify(selectedIds));
}

function loadMapSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(mapSettingsKey));
    if (saved && typeof saved === "object") {
      return {
        ...defaultMapSettings,
        lngOffset: Number.isFinite(Number(saved.lngOffset)) ? Number(saved.lngOffset) : defaultMapSettings.lngOffset,
        latOffset: Number.isFinite(Number(saved.latOffset)) ? Number(saved.latOffset) : defaultMapSettings.latOffset,
        widthScale: Number.isFinite(Number(saved.widthScale)) ? Number(saved.widthScale) : defaultMapSettings.widthScale,
        heightScale: Number.isFinite(Number(saved.heightScale)) ? Number(saved.heightScale) : defaultMapSettings.heightScale
      };
    }
  } catch {
    localStorage.removeItem(mapSettingsKey);
  }
  return { ...defaultMapSettings };
}

function saveMapSettings() {
  localStorage.setItem(mapSettingsKey, JSON.stringify(mapSettings));
}

function loadCustomCities() {
  try {
    const saved = JSON.parse(localStorage.getItem(customCitiesKey));
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
    localStorage.removeItem(customCitiesKey);
  }
  return [];
}

function saveCustomCities() {
  localStorage.setItem(customCitiesKey, JSON.stringify(customCities));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function allCities() {
  return [...cityCatalog, ...customCities];
}

function findCity(id) {
  return allCities().find((city) => city.id === id);
}

function isValidZone(zone) {
  const resolved = resolveZone(zone);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: resolved }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function mapPosition(city) {
  return {
    x: clamp(50 + (city.x - 50) * mapSettings.widthScale + mapSettings.lngOffset, 0, 100),
    y: clamp(50 + (city.y - 50) * mapSettings.heightScale + mapSettings.latOffset, 0, 100)
  };
}

function formatTime(date, zone, options = {}) {
  const resolved = resolveZone(zone);
  const locale = currentLang === "zh" ? "zh-TW" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: resolved,
    hour: "2-digit",
    minute: options.withMinutes === false ? undefined : "2-digit",
    hour12: false,
    weekday: options.weekday ? "short" : undefined
  }).format(date);
}

function hourInZone(date, zone) {
  const resolved = resolveZone(zone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolved,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour").value);
}

function utcOffsetText(date, zone) {
  const resolved = resolveZone(zone);
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
}

function makeBaseHours() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  baseHours = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(start);
    date.setHours(start.getHours() + index);
    return date;
  });
}

function timeTone(hour) {
  if (hour >= 8 && hour < 18) return "day";
  if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 22)) return "evening";
  return "night";
}

function renderMap() {
  cityLayer.innerHTML = "";
  allCities().forEach((city) => {
    const position = mapPosition(city);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `city-pin${selectedIds.includes(city.id) ? " is-selected" : ""}`;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    const cityName = getCityName(city);
    button.title = cityName;
    button.setAttribute("aria-label", getTranslation("selectCity", { name: cityName }));
    button.addEventListener("click", () => toggleCity(city.id));
    cityLayer.append(button);
  });
}

function formatSettingValue(key) {
  if (key.endsWith("Scale")) return mapSettings[key].toFixed(2);
  return String(Math.round(mapSettings[key]));
}

function renderSettingsControls() {
  document.querySelectorAll("[data-setting]").forEach((input) => {
    const key = input.dataset.setting;
    input.value = String(mapSettings[key]);
  });

  document.querySelectorAll("[data-output]").forEach((output) => {
    const key = output.dataset.output;
    output.textContent = formatSettingValue(key);
  });
}

function updateMapSetting(key, value) {
  const input = document.querySelector(`[data-setting="${key}"]`);
  if (!input) return;

  const min = Number(input.min);
  const max = Number(input.max);
  const next = clamp(Number(value), min, max);
  mapSettings = {
    ...mapSettings,
    [key]: key.endsWith("Scale") ? Number(next.toFixed(2)) : Math.round(next)
  };
  saveMapSettings();
  renderSettingsControls();
  renderMap();
}

function wireSettings() {
  settingsButton.addEventListener("click", () => {
    const isOpen = settingsPanel.hidden;
    settingsPanel.hidden = !isOpen;
    settingsButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("input", () => {
      updateMapSetting(input.dataset.setting, input.value);
    });
  });

  document.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.adjust;
      const delta = Number(button.dataset.delta);
      updateMapSetting(key, mapSettings[key] + delta);
    });
  });

  resetMapButton.addEventListener("click", () => {
    mapSettings = { ...defaultMapSettings };
    saveMapSettings();

    timePeriods = JSON.parse(JSON.stringify(defaultTimePeriods));
    saveTimePeriods();
    renderPeriodSettings();

    renderSettingsControls();
    renderMap();
    render();
  });

  addCustomCityButton.addEventListener("click", () => {
    const name = customCityName.value.trim();
    const zone = customCityZone.value.trim();
    const x = Number(customCityX.value);
    const y = Number(customCityY.value);
    if (!name || !zone || !isValidZone(zone)) return;

    customCities = [
      ...customCities,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        zone,
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100)
      }
    ];
    saveCustomCities();
    customCityName.value = "";
    customCityZone.value = "";
    renderCustomCityEditor();
    render();
  });
}


function renderHeader() {
  hourHeader.innerHTML = "";
  baseHours.forEach((date) => {
    const label = document.createElement("span");
    label.textContent = String(date.getHours()).padStart(2, "0");
    hourHeader.append(label);
  });
}

function renderRows() {
  timelineRows.innerHTML = "";
  selectedIds.forEach((id) => {
    const city = findCity(id);
    if (!city) return;
    const row = document.createElement("article");
    row.className = "timeline-row";

    const label = document.createElement("div");
    label.className = "city-label";

    const cityName = getCityName(city);
    const labelText = document.createElement("div");
    labelText.className = "city-label-text";
    labelText.innerHTML = `<span class="city-name">${cityName}</span><span class="city-time">${utcOffsetText(new Date(), city.zone)} · ${formatTime(new Date(), city.zone)}</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-city-btn";
    removeBtn.textContent = "×";
    removeBtn.title = getTranslation("removeCity", { name: cityName });
    removeBtn.setAttribute("aria-label", getTranslation("removeCity", { name: cityName }));
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCity(city.id);
    });

    label.append(labelText, removeBtn);

    const hours = document.createElement("div");
    hours.className = "hours";

    baseHours.forEach((date, index) => {
      const cityHour = hourInZone(date, city.zone);
      const cell = document.createElement("div");
      cell.className = `hour-cell${index === 0 ? " is-now" : ""}`;
      cell.dataset.index = String(index);
      cell.textContent = String(cityHour).padStart(2, "0");
      cell.title = `${cityName} ${formatTime(date, city.zone)}`;

      const styleInfo = getHourStyle(cityHour);
      cell.style.backgroundColor = styleInfo.color;
      cell.style.color = styleInfo.fontColor;

      hours.append(cell);
    });

    row.append(label, hours);
    timelineRows.append(row);
  });
}

function toggleCity(id) {
  if (selectedIds.includes(id)) {
    if (selectedIds.length === 1) return;
    selectedIds = selectedIds.filter((item) => item !== id);
  } else {
    selectedIds = [...selectedIds.slice(-(maxCities - 1)), id];
  }
  saveSelection();
  render();
}

function renderCustomCityEditor() {
  customCityList.innerHTML = "";
  customCities.forEach((city) => {
    const item = document.createElement("div");
    item.className = "custom-city-item";
    item.innerHTML = `
      <input data-field="name" value="${city.name.replaceAll('"', "&quot;")}">
      <input data-field="zone" value="${city.zone.replaceAll('"', "&quot;")}">
      <input data-field="x" type="number" min="0" max="100" step="0.1" value="${city.x}">
      <input data-field="y" type="number" min="0" max="100" step="0.1" value="${city.y}">
      <button type="button">${getTranslation("updateBtn")}</button>
      <button type="button">${getTranslation("deleteBtn")}</button>
    `;

    const inputs = item.querySelectorAll("input");
    const updateButton = item.querySelectorAll("button")[0];
    const deleteButton = item.querySelectorAll("button")[1];

    updateButton.addEventListener("click", () => {
      const nextName = inputs[0].value.trim();
      const nextZone = inputs[1].value.trim();
      if (!nextName || !isValidZone(nextZone)) return;
      customCities = customCities.map((existing) =>
        existing.id === city.id
          ? {
              ...existing,
              name: nextName,
              zone: nextZone,
              x: clamp(Number(inputs[2].value), 0, 100),
              y: clamp(Number(inputs[3].value), 0, 100)
            }
          : existing
      );
      saveCustomCities();
      renderCustomCityEditor();
      render();
    });

    deleteButton.addEventListener("click", () => {
      customCities = customCities.filter((existing) => existing.id !== city.id);
      selectedIds = selectedIds.filter((selectedId) => selectedId !== city.id);
      saveCustomCities();
      saveSelection();
      renderCustomCityEditor();
      render();
    });

    customCityList.append(item);
  });
}

function updateHover(index) {
  const hourGrid = document.querySelector(".hours");
  if (!hourGrid) return;
  const gridRect = hourGrid.getBoundingClientRect();
  const panelRect = timelinePanel.getBoundingClientRect();
  const cellWidth = gridRect.width / 24;
  hoverGuide.style.left = `${gridRect.left - panelRect.left + cellWidth * index + cellWidth / 2}px`;
  timelinePanel.classList.add("is-hovering");
}

function wireTimelineHover() {
  timelinePanel.addEventListener("mousemove", (event) => {
    const cell = event.target.closest(".hour-cell");
    if (!cell) return;
    updateHover(Number(cell.dataset.index));
  });

  timelinePanel.addEventListener("mouseleave", () => {
    timelinePanel.classList.remove("is-hovering");
  });
}

function renderNowText() {
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  nowText.textContent = `${getTranslation("localTimezone")} ${localZone} · ${formatTime(new Date(), localZone, { weekday: true })}`;
}

function populatePeriodSelectors() {
  document.querySelectorAll(".period-start, .period-end").forEach((select) => {
    select.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = String(h).padStart(2, "0");
      select.appendChild(opt);
    }
  });
}

function renderPeriodSettings() {
  timePeriods.forEach((period, idx) => {
    const row = document.querySelector(`.period-setting-row[data-period="${idx}"]`);
    if (!row) return;
    row.querySelector(".period-start").value = period.start;
    row.querySelector(".period-end").value = period.end;
    row.querySelector(".period-bg-color").value = period.color;
    row.querySelector(".period-text-color").value = period.fontColor;
  });
}

function wirePeriodSettings() {
  timePeriods.forEach((period, idx) => {
    const row = document.querySelector(`.period-setting-row[data-period="${idx}"]`);
    if (!row) return;

    row.querySelector(".period-start").addEventListener("change", (e) => {
      timePeriods[idx].start = Number(e.target.value);
      saveTimePeriods();
      render();
    });

    row.querySelector(".period-end").addEventListener("change", (e) => {
      timePeriods[idx].end = Number(e.target.value);
      saveTimePeriods();
      render();
    });

    row.querySelector(".period-bg-color").addEventListener("change", (e) => {
      timePeriods[idx].color = e.target.value;
      saveTimePeriods();
      render();
    });

    row.querySelector(".period-text-color").addEventListener("change", (e) => {
      timePeriods[idx].fontColor = e.target.value;
      saveTimePeriods();
      render();
    });
  });
}

function render() {
  makeBaseHours();
  renderNowText();
  renderMap();
  renderHeader();
  renderRows();
  renderCustomCityEditor();
  renderPeriodSettings();
}

resetButton.addEventListener("click", () => {
  selectedIds = [...defaultSelection];
  saveSelection();
  render();
});

wireSettings();
wireTimelineHover();
renderSettingsControls();

langSelect.value = currentLang;
langSelect.addEventListener("change", (e) => {
  currentLang = e.target.value;
  saveLanguage(currentLang);
  applyLanguage();
  render();
});

populatePeriodSelectors();
wirePeriodSettings();
applyLanguage();
render();
setInterval(render, 60 * 1000);
