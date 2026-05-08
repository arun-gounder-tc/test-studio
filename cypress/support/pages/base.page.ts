/**
 * BasePage — abstract POM. All page objects extend this.
 * Encapsulates common operations so step definitions stay declarative.
 */
export abstract class BasePage {
  abstract readonly path: string;

  visit(): this {
    cy.visit(this.path);
    return this;
  }

  shouldBeOnPage(): this {
    cy.url().should('include', this.path);
    return this;
  }
}
