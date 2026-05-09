import { defineConfig } from 'cypress';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';
import studioConfig from './config/studio.config.json';

// baseUrl only applied when CY_USE_BASE_URL=1 (so smoke tests with absolute URLs
// don't fail when the target app isn't running). Once novamark-fe runs locally,
// set CY_USE_BASE_URL=1 in env or remove this guard.
const baseUrl = process.env.CY_USE_BASE_URL === '1'
  ? studioConfig.targetApp.baseUrl
  : undefined;

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: ['cypress/e2e/**/*.feature', '.workspace/**/cypress/e2e/**/*.feature'],
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1440,
    viewportHeight: 900,
    video: true,
    videosFolder: '.test-studio/runs/videos',
    screenshotsFolder: '.test-studio/runs/screenshots',
    downloadsFolder: '.test-studio/runs/downloads',
    chromeWebSecurity: false,
    defaultCommandTimeout: 8000,

    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config);
      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config)],
        })
      );
      return config;
    },
  },
});
