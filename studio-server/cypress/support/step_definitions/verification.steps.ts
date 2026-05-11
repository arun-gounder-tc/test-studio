import { Then } from '@badeball/cypress-cucumber-preprocessor';

Then('I should see {string}', (text: string) => {
  cy.contains(text).should('be.visible');
});

Then('I should not see {string}', (text: string) => {
  cy.contains(text).should('not.exist');
});

Then('the {string} element should be visible', (selector: string) => {
  cy.get(selector).should('be.visible');
});

Then('there should be {int} {string}', (count: number, selector: string) => {
  cy.get(selector).should('have.length', count);
});

Then('the URL should contain {string}', (fragment: string) => {
  cy.url().should('include', fragment);
});
