import { defineConfig } from "cypress";

export default defineConfig({

  e2e: {
    baseUrl: "https://localhost",
    env: {
      apiUrl: "/api/"
    },

    setupNodeEvents(on, config) {

      return config;
    },
  },
});