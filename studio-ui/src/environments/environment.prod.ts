/**
 * Production environment — loaded for `npm run build` / Firebase Hosting build.
 *
 * IMPORTANT: replace `<COOLIFY_BACKEND_URL>` below with your deployed
 * studio-server URL once it's live on Coolify. Example:
 *   apiBaseUrl: 'https://test-studio-api.yourdomain.com/api/test-studio'
 *
 * The path MUST include `/api/test-studio` at the end — that's the prefix
 * the backend mounts all routes under (see studio-server/src/server.ts).
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://test-studio-be.undercontrol.in/api/test-studio',
};
