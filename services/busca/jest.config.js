/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  passWithNoTests: true,
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tests/tsconfig.json", diagnostics: { ignoreCodes: [151002] } }] },
  moduleNameMapper: { "^@agnus/comum/(.*)$": "<rootDir>/../comum/src/$1" },
  collectCoverageFrom: ["src/**/*.ts"],
};
