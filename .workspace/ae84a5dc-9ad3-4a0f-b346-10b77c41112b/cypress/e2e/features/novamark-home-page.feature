Feature: NovaMark Home Page
  Load the Webpage

  @smoke @ai-generated
  Scenario: Home page loads correctly
    When I navigate to "https://novamark.hubblehox.ai/sign-in"
    Then the URL should contain "https://novamark.hubblehox.ai/sign-in"
    Then I should see "Login"