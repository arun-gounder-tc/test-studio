Feature: Novamark home page
  Load the Webpage

  @novamark
  Scenario: Home page loads at https://novamark.hubblehox.ai/sign-in
    When I navigate to "https://novamark.hubblehox.ai/"
    Then the URL should contain "https://novamark.hubblehox.ai/"
    When I click on "Forgot Password"
    Then the URL should contain "/sign-in"