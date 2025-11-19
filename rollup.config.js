import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/lovelace-personal-wakeup-card.ts",
  output: {
    file: "dist/lovelace-personal-wakeup-card.js",
    format: "es",
    sourcemap: true
  },
  plugins: [
    resolve({
      browser: true
    }),
    commonjs(),
    typescript()
  ]
};
