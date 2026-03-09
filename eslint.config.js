const tseslint = require("typescript-eslint")

module.exports = tseslint.config(
  {
    ignores: ["dist/**"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        CustomEvent: "readonly",
        Element: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-undef": "off"
    }
  }
)
