/**
 * Dev environment — loaded when running `npm start`.
 * The prod build (`npm run build`) replaces this with environment.prod.ts
 * via angular.json fileReplacements.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3001/api/test-studio',
};
