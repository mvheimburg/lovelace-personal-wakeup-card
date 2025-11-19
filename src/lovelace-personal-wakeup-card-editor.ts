import { LitElement, html, css } from "lit";
import { property, state, customElement } from "lit/decorators.js";

interface HomeAssistant {
  states: Record<string, any>;
}

interface PersonalWakeupCardConfig {
  type: string;
  entity: string;
  name?: string;
}

@customElement("lovelace-personal-wakeup-card-editor")
export class PersonalWakeupCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: PersonalWakeupCardConfig;

  public setConfig(config: PersonalWakeupCardConfig): void {
    this._config = { ...config };
  }

  private _valueChanged(ev: Event): void {
    if (!this._config) return;
    const target = ev.target as HTMLInputElement;
    const field = target.dataset.configValue;
    if (!field) return;

    const newConfig = { ...this._config };

    if (target.value === "" && field !== "entity") {
      delete (newConfig as any)[field];
    } else {
      (newConfig as any)[field] = target.value;
    }

    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig }
    });
    this.dispatchEvent(event);
  }

  protected render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const entity = this._config.entity || "";
    const name = this._config.name || "";

    const entities = Object.keys(this.hass.states).filter((eid) =>
      eid.startsWith("wakeup_alarm.")
    );

    return html`
      <div class="form">
        <div class="row">
          <label>Entity</label>
          <select
            .value=${entity}
            data-config-value="entity"
            @change=${this._valueChanged}
          >
            <option value="">-- Select wakeup alarm entity --</option>
            ${entities.map(
              (eid) => html`
                <option value=${eid} ?selected=${eid === entity}>
                  ${eid}
                </option>
              `
            )}
          </select>
        </div>

        <div class="row">
          <label>Name (optional)</label>
          <input
            type="text"
            .value=${name}
            data-config-value="name"
            @input=${this._valueChanged}
          />
        </div>
      </div>
    `;
  }

  static styles = css`
    .form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px;
    }

    .row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    label {
      font-size: 0.9rem;
      color: var(--secondary-text-color);
    }

    select,
    input[type="text"] {
      padding: 4px 6px;
      font-size: 0.9rem;
      border-radius: 4px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--primary-text-color);
    }
  `;
}
