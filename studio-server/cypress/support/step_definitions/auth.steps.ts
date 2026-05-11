import { Given } from '@badeball/cypress-cucumber-preprocessor';

Given('I am logged in as {string}', (role: string) => {
  cy.loginAs(role);
});

Given('I am not logged in', () => {
  cy.clearCookies();
  cy.clearLocalStorage();
});
