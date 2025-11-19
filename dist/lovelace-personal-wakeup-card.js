// wakeup-alarm-card.js
// Simple, vanilla Web Component custom card for Home Assistant.
// Expects an entity like wakeup_alarm.wakeup_alarm that exposes attributes:
//  - enabled (bool)
//  - time_of_day (string "HH:MM" or "HH:MM:SS" or ISO datetime)
//  - fade_duration (int seconds)
//  - volume (float 0–1)
//  - playlist (string)
//  - playlist_options (optional string[])
//  - next_fire (ISO string or null)
//  - require_home (bool)
//  - device_tracker_entity (optional string)
//
// And supports a service "<domain>.set_config" with fields:
//  - entity_id
//  - enabled, time_of_day, fade_duration, volume, playlist,
//    require_home (all optional, partial updates allowed)
// Optionally: "<domain>.trigger_now" with "entity_id".


class WakeupAlarmCard extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this.attachShadow({ mode: "open" });
  }

  //////////////////////////////////////////////////////////////////////
  // Home Assistant card interface
  //////////////////////////////////////////////////////////////////////

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._render();
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You must specify an entity for wakeup-alarm-card");
    }
    this._config = config;
    if (!this._hass) return;
    this._render();
  }

  static getConfigElement() {
    // No fancy editor for now; HA will fall back to YAML editor.
    return null;
  }

  static getStubConfig() {
    return {
      entity: "wakeup_alarm.wakeup_alarm",
      name: "Wakeup Alarm"
    };
  }

  getCardSize() {
    return 4;
  }

  //////////////////////////////////////////////////////////////////////
  // Rendering
  //////////////////////////////////////////////////////////////////////

  _render() {
    const hass = this._hass;
    const config = this._config;
    const entityId = config.entity;

    const stateObj = hass.states[entityId];
    if (!stateObj) {
      this._renderError(`Entity ${entityId} not found`);
      return;
    }

    const attrs = stateObj.attributes;

    const enabled = Boolean(attrs.enabled);
    const requireHome = Boolean(attrs.require_home);
    const timeOfDay = this._normalizeTime(attrs.time_of_day);
    const fadeDuration = Number(attrs.fade_duration ?? 900);
    const volume = Number(attrs.volume ?? 0.25);
    const playlist = attrs.playlist ?? "";
    const playlistOptions = attrs.playlist_options || [];
    const nextFire = attrs.next_fire || null;
    const deviceTracker = attrs.device_tracker_entity || null;

    const title =
      config.name || stateObj.attributes.friendly_name || "Wakeup Alarm";
    const state = stateObj.state;

    const fadeMinutes = Math.round(fadeDuration / 60);
    const volumePercent = Math.round(volume * 100);

    // Build static HTML template
    const html = `
      <style>
        ha-card {
          padding: 16px;
          box-sizing: border-box;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .title {
          font-size: 1.1rem;
          font-weight: 600;
        }

        .state-pill {
          font-size: 0.8rem;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 16px;
        }

        .row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .row.horizontal {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }

        .label {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
        }

        .value {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .footer {
          margin-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          color: var(--secondary-text-color);
        }

        .time-input {
          width: 100%;
          box-sizing: border-box;
        }

        select,
        input[type="time"] {
          padding: 4px 6px;
          font-size: 0.9rem;
          border-radius: 4px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }

        ha-slider {
          width: 100%;
        }

        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip {
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid var(--divider-color);
          font-size: 0.75rem;
          cursor: pointer;
        }

        .small {
          font-size: 0.75rem;
        }
      </style>

      <ha-card>
        <div class="header">
          <div class="title">${title}</div>
          <div class="state-pill">${state}</div>
        </div>

        <div class="grid">
          <!-- Enabled switch -->
          <div class="row horizontal">
            <span class="label">Enabled</span>
            <ha-switch id="enabled"></ha-switch>
          </div>

          <!-- Require home -->
          <div class="row horizontal">
            <span class="label">Require home</span>
            <ha-switch id="require_home"></ha-switch>
          </div>

          <!-- Time of day -->
          <div class="row">
            <span class="label">Alarm time</span>
            <input
              class="time-input"
              id="time_of_day"
              type="time"
              value="${timeOfDay}"
            />
          </div>

          <!-- Fade duration -->
          <div class="row">
            <span class="label">Fade duration (min)</span>
            <ha-slider
              id="fade_slider"
              min="1"
              max="45"
              step="1"
              value="${fadeMinutes}"
              pin
            ></ha-slider>
            <span class="value" id="fade_value">${fadeMinutes} min</span>
          </div>

          <!-- Volume -->
          <div class="row">
            <span class="label">Volume</span>
            <ha-slider
              id="volume_slider"
              min="0"
              max="1"
              step="0.05"
              value="${volume}"
              pin
            ></ha-slider>
            <span class="value" id="volume_value">${volumePercent}%</span>
          </div>

          <!-- Playlist selector -->
          <div class="row">
            <span class="label">Playlist</span>
            ${
              playlistOptions.length
                ? `
              <select id="playlist">
                ${playlistOptions
                  .map(
                    (opt) => `
                  <option value="${opt}" ${
                      opt === playlist ? "selected" : ""
                    }>
                    ${opt}
                  </option>`
                  )
                  .join("")}
              </select>
            `
                : `
              <span class="value">${playlist || "Default"}</span>
            `
            }
          </div>
        </div>

        <div class="footer">
          <div>
            Next alarm:<br />
            <span class="value">
              ${
                nextFire
                  ? this._formatNextFire(nextFire)
                  : "Not scheduled"
              }
            </span>
            ${
              deviceTracker
                ? `<div class="small">Device: ${deviceTracker}</div>`
                : ""
            }
          </div>
          <div class="chips">
            <div class="chip" id="trigger_now">Trigger now</div>
          </div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.innerHTML = html;

    // Wire up dynamic state & events
    const enabledSwitch = this.shadowRoot.getElementById("enabled");
    const requireHomeSwitch = this.shadowRoot.getElementById("require_home");
    const timeInput = this.shadowRoot.getElementById("time_of_day");
    const fadeSlider = this.shadowRoot.getElementById("fade_slider");
    const fadeValue = this.shadowRoot.getElementById("fade_value");
    const volumeSlider = this.shadowRoot.getElementById("volume_slider");
    const volumeValue = this.shadowRoot.getElementById("volume_value");
    const playlistSelect = this.shadowRoot.getElementById("playlist");
    const triggerNowBtn = this.shadowRoot.getElementById("trigger_now");

    if (enabledSwitch) {
      enabledSwitch.checked = enabled;
      enabledSwitch.addEventListener("change", (e) => {
        this._updateConfig({ enabled: e.target.checked });
      });
    }

    if (requireHomeSwitch) {
      requireHomeSwitch.checked = requireHome;
      requireHomeSwitch.addEventListener("change", (e) => {
        this._updateConfig({ require_home: e.target.checked });
      });
    }

    if (timeInput) {
      timeInput.addEventListener("change", (e) => {
        this._updateConfig({ time_of_day: e.target.value });
      });
    }

    if (fadeSlider && fadeValue) {
      fadeSlider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        fadeValue.textContent = `${v} min`;
      });
      fadeSlider.addEventListener("change", (e) => {
        const v = Number(e.target.value);
        this._updateConfig({ fade_duration: v * 60 });
      });
    }

    if (volumeSlider && volumeValue) {
      volumeSlider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        volumeValue.textContent = `${Math.round(v * 100)}%`;
      });
      volumeSlider.addEventListener("change", (e) => {
        const v = Number(e.target.value);
        this._updateConfig({ volume: v });
      });
    }

    if (playlistSelect) {
      playlistSelect.addEventListener("change", (e) => {
        this._updateConfig({ playlist: e.target.value });
      });
    }

    if (triggerNowBtn) {
      triggerNowBtn.addEventListener("click", () => this._triggerNow());
    }
  }

  _renderError(message) {
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: 16px;
          box-sizing: border-box;
        }
        .error {
          color: var(--error-color, red);
        }
      </style>
      <ha-card>
        <div class="error">${message}</div>
      </ha-card>
    `;
  }

  //////////////////////////////////////////////////////////////////////
  // Helpers
  //////////////////////////////////////////////////////////////////////

  _normalizeTime(value) {
    // Accept "HH:MM", "HH:MM:SS" or full ISO, return "HH:MM"
    if (!value) return "07:00";

    try {
      if (value.length === 5 && value.includes(":")) {
        return value;
      }
      if (value.length >= 8 && value.includes(":") && value.indexOf(":") === 2) {
        // "HH:MM:SS"
        return value.slice(0, 5);
      }
      // ISO datetime
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      }
    } catch (e) {
      // ignore and fallback
    }
    return "07:00";
  }

  _formatNextFire(value) {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleString();
    } catch (e) {
      return value;
    }
  }

  _updateConfig(partial) {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return;

    const entityId = config.entity;
    const [domain] = entityId.split(".");

    hass.callService(domain, "set_config", {
      entity_id: entityId,
      ...partial
    });
  }

  _triggerNow() {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return;

    const entityId = config.entity;
    const [domain] = entityId.split(".");

    hass.callService(domain, "trigger_now", {
      entity_id: entityId
    });
  }
}

customElements.define("wakeup-alarm-card", WakeupAlarmCard);

// Register in the card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "wakeup-alarm-card",
  name: "Wakeup Alarm Card",
  description:
    "Control a Personal Wakeup alarm entity (time, fade, volume, playlist, require_home)."
});
