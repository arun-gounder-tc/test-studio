import { When } from '@badeball/cypress-cucumber-preprocessor';

When('I enter {string} in the {string} field', (value: string, label: string) => {
  cy.contains('label', label)
    .invoke('attr', 'for')
    .then((id) => {
      if (id) {
        cy.get(`#${id}`).clear().type(value);
      } else {
        cy.get(`[name="${label}"], [data-cy="${label}"], [placeholder="${label}"]`).first().clear().type(value);
      }
    });
});

When('I type {string} into {string}', (value: string, selector: string) => {
  cy.get(selector).clear().type(value);
});

When('I click the {string} button', (label: string) => {
  cy.contains('button', label).click();
});

When('I click on {string}', (label: string) => {
  cy.contains(label).click();
});

When('I select {string} from the {string} dropdown', (option: string, label: string) => {
  cy.contains('label', label)
    .parent()
    .find('select, [role=combobox]')
    .first()
    .select(option);
});
