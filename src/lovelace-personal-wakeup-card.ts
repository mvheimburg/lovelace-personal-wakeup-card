import { LitElement, css, html, nothing } from "lit";
import { property, state, customElement } from "lit/decorators.js";
import "./lovelace-personal-wakeup-card-editor";

interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}

interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(
    domain: string,
    service: string,
    data?: Record<string, any>
  ): void;
  formatDateTime(date: Date): string;
}

interface PersonalWakeupCardConfig {
  type: string;
  entity: string;
  name?: string;
}

@customElement("lovelace-personal-wakeup-card")
export class PersonalWakeupCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: PersonalWakeupCardConfig;

  public setConfig(config: PersonalWakeupCardConfig): void {
    if (!config.entity) {
      throw new Error("You must define an entity for lovelace-personal-wakeup-card");
    }
    this._config = config;
  }

  // Let Lovelace know how big this card is
  public getCardSize(): number {
    return 4;
  }

  // Called by HA visual editor
  public static async getConfigElement(): Promise<Element> {
    return document.createElement("lovelace-personal-wakeup-card-editor");
  }

  public static getStubConfig(): PersonalWakeupCardConfig {
    return {
      type: "custom:lovelace-personal-wakeup-card",
      entity: "sensor.wakeup_alarm"
    };
  }

  private _getEntity(): HassEntity | undefined {
    if (!this.hass || !this._config) return undefined;
    return this.hass.states[this._config.entity];
  }

  private _normalizeTime(value: unknown): string {
    if (!value) return "07:00";
    const s = String(value);

    // "HH:MM"
    if (s.length === 5 && s.includes(":")) {
      return s;
    }
    // "HH:MM:SS"
    if (s.length >= 8 && s.includes(":") && s.indexOf(":") === 2) {
      return s.slice(0, 5);
    }
    // ISO-ish
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    return "07:00";
  }

  private _formatNextFire(value: string | null): string {
    if (!value) return "Not scheduled";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      // Use HA formatting if available
      if (this.hass && "formatDateTime" in this.hass) {
        return (this.hass as any).formatDateTime(d);
      }
      return d.toLocaleString();
    } catch {
      return value;
    }
  }

  private _updateConfig(partial: Record<string, unknown>): void {
    const entityId = this._config.entity;

    this.hass.callService("personal_wakeup", "set_config", {
      entity_id: entityId,
      ...partial
    });
  }

  private _triggerNow(): void {
    const entityId = this._config.entity;

    this.hass.callService("personal_wakeup", "trigger_now", {
      entity_id: entityId
    });
  }

  private _snooze(): void {
    const entityId = this._config.entity;

    this.hass.callService("personal_wakeup", "snooze", {
      entity_id: entityId
    });
  }

  private _stop(): void {
    const entityId = this._config.entity;

    this.hass.callService("personal_wakeup", "stop", {
      entity_id: entityId
    });
  }

  protected render() {
    const stateObj = this._getEntity();
    if (!stateObj) {
      return html`
        <ha-card>
          <div class="error">
            Entity ${this._config?.entity || "(not set)"} not found
          </div>
        </ha-card>
      `;
    }

    const attrs = stateObj.attributes;
    const enabled = Boolean(attrs.enabled);
    const requireHome = Boolean(attrs.require_home);
    const timeOfDay = this._normalizeTime(attrs.time_of_day);
    const fadeDuration = Number(attrs.fade_duration ?? 900);
    const volume = Number(attrs.volume ?? 0.25);
    const playlist = attrs.playlist ?? "";
    const nextFire: string | null = attrs.next_fire ?? null;
    const personEntity: string | null = attrs.person_entity ?? null;
    const canSnooze =
      Boolean(attrs.can_snooze) || stateObj.state === "triggered";
    const canStop =
      Boolean(attrs.can_stop) ||
      stateObj.state === "triggered" ||
      stateObj.state === "snoozed";
    const snoozeMinutes = Number(attrs.snooze_minutes ?? 10);

    const fadeMinutes = Math.round(fadeDuration / 60);
    const volumePercent = Math.round(volume * 100);

    const title =
      this._config.name || stateObj.attributes.friendly_name || "Wakeup Alarm";

    let playlistOptions: string[] = [];
    if (Array.isArray(attrs.playlist_options)) {
      playlistOptions = attrs.playlist_options as string[];
    } else if (attrs.playlist_options) {
      // handle string or anything weird by splitting on comma
      playlistOptions = String(attrs.playlist_options)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${title}</div>
          <div class="state-pill">${stateObj.state}</div>
        </div>

        <div class="grid">
          <div class="row horizontal">
            <span class="label">Enabled</span>
            <ha-switch
              .checked=${enabled}
              @change=${(e: Event) =>
                this._updateConfig({
                  enabled: (e.target as HTMLInputElement).checked
                })}
            ></ha-switch>
          </div>

          <div class="row horizontal">
            <span class="label">Require home</span>
            <ha-switch
              .checked=${requireHome}
              @change=${(e: Event) =>
                this._updateConfig({
                  require_home: (e.target as HTMLInputElement).checked
                })}
            ></ha-switch>
          </div>

          <div class="row">
            <span class="label">Alarm time</span>
            <input
              class="time-input"
              type="time"
              .value=${timeOfDay}
              @change=${(e: Event) =>
                this._updateConfig({
                  time_of_day: (e.target as HTMLInputElement).value
                })}
            />
          </div>

          <div class="row">
            <span class="label">Fade duration (min)</span>
            <ha-slider
              min="1"
              max="45"
              step="1"
              .value=${fadeMinutes}
              @input=${(e: Event) =>
                ((this.shadowRoot!.getElementById(
                  "fade_value"
                ) as HTMLElement).textContent =
                  String(
                    (e.target as HTMLInputElement).value
                  ) + " min")}
              @change=${(e: Event) =>
                this._updateConfig({
                  fade_duration:
                    Number((e.target as HTMLInputElement).value) * 60
                })}
            ></ha-slider>
            <span class="value" id="fade_value">${fadeMinutes} min</span>
          </div>

          <div class="row">
            <span class="label">Volume</span>
            <ha-slider
              min="0"
              max="1"
              step="0.05"
              .value=${volume}
              @input=${(e: Event) =>
                ((this.shadowRoot!.getElementById(
                  "volume_value"
                ) as HTMLElement).textContent =
                  String(
                    Math.round(
                      Number((e.target as HTMLInputElement).value) * 100
                    )
                  ) + "%")}
              @change=${(e: Event) =>
                this._updateConfig({
                  volume: Number((e.target as HTMLInputElement).value)
                })}
            ></ha-slider>
            <span class="value" id="volume_value">${volumePercent}%</span>
          </div>

          <div class="row">
            <span class="label">Playlist</span>
            ${playlistOptions.length
              ? html`
                  <select
                    @change=${(e: Event) =>
                      this._updateConfig({
                        playlist: (e.target as HTMLSelectElement).value
                      })}
                  >
                    ${playlistOptions.map(
                      (opt) => html`
                        <option
                          .value=${opt}
                          ?selected=${opt === playlist}
                        >
                          ${opt}
                        </option>
                      `
                    )}
                  </select>
                `
              : html`<span class="value">${playlist || "Default"}</span>`}
          </div>
        </div>

        <div class="footer">
          <div>
            Next alarm:<br />
            <span class="value">
              ${this._formatNextFire(nextFire)}
            </span>
            ${personEntity
              ? html`<div class="small">Person: ${personEntity}</div>`
              : nothing}
          </div>
          <div class="actions">
            <button class="action" type="button" @click=${() => this._triggerNow()}>
              Trigger now
            </button>
            ${canSnooze
              ? html`
                  <button
                    class="action action-secondary"
                    type="button"
                    @click=${() => this._snooze()}
                  >
                    Snooze ${snoozeMinutes} min
                  </button>
                `
              : nothing}
            ${canStop
              ? html`
                  <button
                    class="action action-danger"
                    type="button"
                    @click=${() => this._stop()}
                  >
                    Stop
                  </button>
                `
              : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  static styles = css`
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
      gap: 12px;
      flex-wrap: wrap;
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

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .action {
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--divider-color);
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 120ms ease, transform 120ms ease;
    }

    .action:hover {
      opacity: 0.92;
    }

    .action:active {
      transform: translateY(1px);
    }

    .action-secondary {
      background: transparent;
      color: var(--primary-text-color);
    }

    .action-danger {
      background: var(--error-color, #db4437);
      color: var(--text-primary-color, #fff);
    }

    .error {
      color: var(--error-color, red);
    }

    .small {
      font-size: 0.75rem;
    }

    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

// Register for the card picker
declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lovelace-personal-wakeup-card",
  name: "Personal Wakeup Card",
  description:
    "Control a Personal Wakeup alarm entity (time, fade, volume, playlist, require_home)."
});
