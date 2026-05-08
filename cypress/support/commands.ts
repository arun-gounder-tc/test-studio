import { authAdapter, TestUser } from '../../config/auth.adapter';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Log into the TARGET APP using the configured auth adapter.
       * Reads credentials from auth.adapter.ts + env vars.
       */
      loginAs(role: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAs', (role: string) => {
  const user: TestUser | undefined = authAdapter.testUsers[role];
  if (!user) {
    throw new Error(`No test user configured for role "${role}" in config/auth.adapter.ts`);
  }
  const password = Cypress.env(user.passwordEnvVar);
  if (!password) {
    cy.log(`⚠ Env var ${user.passwordEnvVar} not set — login may fail`);
  }

  switch (authAdapter.type) {
    case 'keycloak':
      cy.log(`🔐 [keycloak] login as ${user.username}`);
      // Phase 1 placeholder: AI Studio will refine in Phase 2
      // For now, we expose the contract — implementation hooks here.
      break;
    case 'form':
      cy.visit('/login');
      cy.get('[data-cy=username], input[name=username]').type(user.username);
      cy.get('[data-cy=password], input[name=password]').type(password ?? '');
      cy.get('[data-cy=login-submit], button[type=submit]').click();
      break;
    case 'none':
      cy.log('🔓 [none] no auth required');
      break;
    default:
      throw new Error(`Auth type "${authAdapter.type}" not implemented yet`);
  }
});

export {};
