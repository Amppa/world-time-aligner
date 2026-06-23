/**
 * World Time Aligner - UI Renderer Module
 */

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
        if (DOM.currentCitiesList) {
          DOM.currentCitiesList.classList.add("is-dragging-active");
        }
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        if (State.draggingId && State.draggingId !== id) {
          // Defensive cleanup: ensure no other card has indicator lines visible
          document.querySelectorAll(".current-city-card").forEach(c => {
            if (c !== card) {
              c.classList.remove("drag-over-top", "drag-over-bottom");
            }
          });

          const rect = card.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const middleY = rect.height / 2;

          if (relativeY < middleY) {
            card.classList.add("drag-over-top");
            card.classList.remove("drag-over-bottom");
          } else {
            card.classList.add("drag-over-bottom");
            card.classList.remove("drag-over-top");
          }
        }
      });

      card.addEventListener("dragenter", (e) => {
        e.preventDefault();
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over-top", "drag-over-bottom");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        if (DOM.currentCitiesList) {
          DOM.currentCitiesList.classList.remove("is-dragging-active");
        }
        document.querySelectorAll(".current-city-card").forEach(c => {
          c.classList.remove("drag-over-top", "drag-over-bottom");
        });
        State.draggingId = null;
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggedId = State.draggingId;
        if (draggedId && draggedId !== id) {
          const oldIndex = State.selectedIds.indexOf(draggedId);
          const newIndex = State.selectedIds.indexOf(id);
          if (oldIndex !== -1 && newIndex !== -1) {
            const dropTop = card.classList.contains("drag-over-top");
            let insertIndex;
            if (oldIndex < newIndex) {
              insertIndex = dropTop ? newIndex - 1 : newIndex;
            } else {
              insertIndex = dropTop ? newIndex : newIndex + 1;
            }

            const list = [...State.selectedIds];
            list.splice(oldIndex, 1);
            list.splice(insertIndex, 0, draggedId);
            State.selectedIds = list;
            State.saveSelection();
            Renderer.render();
          }
        }
        if (DOM.currentCitiesList) {
          DOM.currentCitiesList.classList.remove("is-dragging-active");
        }
        document.querySelectorAll(".current-city-card").forEach(c => {
          c.classList.remove("drag-over-top", "drag-over-bottom");
        });
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
      row.querySelector(".period-bg-color").value = ColorUtils.toHex7(period.color);
      row.querySelector(".period-text-color").value = ColorUtils.toHex7(period.fontColor);
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
