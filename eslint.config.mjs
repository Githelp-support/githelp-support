import { createRequire } from "module";

const require = createRequire(import.meta.url);

// eslint-config-next 16 exports flat configs (no FlatCompat needed)
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

const config = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "docs/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
