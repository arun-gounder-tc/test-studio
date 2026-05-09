Feature: Novamark Sign-in Page
  Load the Sign-in Page

  @novamark @ai-generated
  Scenario: Sign-in page loads at https://novamark.hubblehox.ai/sign-in
    When I navigate to "https://novamark.hubblehox.ai/sign-in"
    Then the URL should contain "/sign-in"
    Then I should see "Login"