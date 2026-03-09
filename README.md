# Lovelace Personal Wakeup Card

Lovelace card for controlling the `personal_wakeup` integration entity.

## Build
```bash
npm ci
npm run build
```

Output bundle:
- `dist/lovelace-personal-wakeup-card.js`

## Install in Home Assistant
1. Copy `dist/lovelace-personal-wakeup-card.js` into your Home Assistant `www` folder.
2. Add a Lovelace resource pointing to that file.
3. Add card type: `custom:lovelace-personal-wakeup-card`.

## Card config
```yaml
type: custom:lovelace-personal-wakeup-card
entity: sensor.your_wakeup_sensor
name: Wakeup (optional)
```
