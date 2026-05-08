import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly path = '/login';

  fillUsername(value: string): this {
    cy.get('[data-cy=username], input[name=username]').clear().type(value);
    return this;
  }

  fillPassword(value: string): this {
    cy.get('[data-cy=password], input[name=password]').clear().type(value, { log: false });
    return this;
  }

  submit(): this {
    cy.get('[data-cy=login-submit], button[type=submit]').click();
    return this;
  }
}
