import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

Given('I open the application', () => {
  cy.visit('/');
});

Given('I navigate to {string}', (path: string) => {
  cy.visit(path);
});

When('I go to {string}', (path: string) => {
  cy.visit(path);
});

Then('I should be on the {string} page', (path: string) => {
  cy.url().should('include', path);
});

Then('the page title should contain {string}', (text: string) => {
  cy.title().should('include', text);
});
