/**
 * Auth adapter — describes HOW Cypress should log into the TARGET APP.
 * This is NOT related to Test Studio's own login.
 *
 * For each new project, only this file (and config/) needs to change.
 * The kit (cypress + studio-server + studio-ui) stays identical.
 */

export type AuthType = 'keycloak' | 'firebase' | 'jwt' | 'form' | 'none';

export interface TestUser {
  username: string;
  passwordEnvVar: string;
  roles?: string[];
}

export interface AuthAdapter {
  type: AuthType;
  config: Record<string, unknown>;
  testUsers: Record<string, TestUser>;
}

export const authAdapter: AuthAdapter = {
  type: 'keycloak',
  config: {
    realm: 'novamark',
    clientId: 'novamark-fe',
    tokenUrl: 'https://auth.novamark.example/realms/novamark/protocol/openid-connect/token',
  },
  testUsers: {
    admin: {
      username: 'qa-admin@thecontrast.in',
      passwordEnvVar: 'CY_ADMIN_PASSWORD',
      roles: ['admin'],
    },
    user: {
      username: 'qa-user@thecontrast.in',
      passwordEnvVar: 'CY_USER_PASSWORD',
      roles: ['user'],
    },
  },
};
