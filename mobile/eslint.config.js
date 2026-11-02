// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// Layer map: ../docs/CONVENTIONS.md#mobile. Each layer lists the @/ folders it may import.
const FRAMEWORKS = {
  react: "^react(/|$)",
  reactNative: "^react-",
  expo: "^(expo|@expo/)",
  matrix: "^@unomed/",
};

const layer = (folder, { allowed, frameworks = [] }) => ({
  files: [`src/${folder}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        {
          regex: `^@/(?!(${allowed.join("|")})/)`,
          message: `A camada '${folder}' só importa de: ${allowed.join(", ")}. Ver docs/CONVENTIONS.md#mobile.`,
        },
        {
          regex: Object.entries(FRAMEWORKS)
            .filter(([name]) => !frameworks.includes(name))
            .map(([, pattern]) => `(${pattern})`)
            .join("|"),
          message: `A camada '${folder}' não depende deste framework. Ver docs/CONVENTIONS.md#mobile.`,
        },
        { group: ["../*"], message: "Use o alias @/ entre pastas." },
      ],
    }],
  },
});

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "coverage/*"] },
  {
    rules: {
      complexity: ["error", 10],
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      "no-nested-ternary": "error",
    },
  },
  layer("domain", { allowed: ["domain"] }),
  layer("ports", { allowed: ["domain", "ports"] }),
  layer("application", { allowed: ["domain", "ports", "application"] }),
  layer("adapters", { allowed: ["domain", "ports", "adapters"], frameworks: ["reactNative", "expo", "matrix"] }),
  layer("state", { allowed: ["domain", "ports", "application", "state"], frameworks: ["react"] }),
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "max-lines-per-function": "off", "no-restricted-imports": "off" },
  },
]);
