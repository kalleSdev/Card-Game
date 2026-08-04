import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        console: "readonly",
        Image: "readonly",
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLCanvasElement: "readonly",
        MouseEvent: "readonly",
        PointerEvent: "readonly",
        SVGSVGElement: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",

      // eslint-plugin-react-hooks v7 ships the React Compiler rule set. This project
      // does not use the compiler, so these are treated as advisory tech-debt signals
      // rather than build failures. The classic rules-of-hooks checks stay as errors.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",

      // The codebase is deliberately `any`-free; keep it that way.
      "@typescript-eslint/no-explicit-any": "error",

      // Unused values are a real signal in a codebase this size, but allow the
      // conventional underscore prefix for intentionally-ignored bindings.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",
    },
  },
);
