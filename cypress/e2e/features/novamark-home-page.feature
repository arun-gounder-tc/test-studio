Feature: Novamark home page
  Load the Webpage

  @smoke @ai-generated
  Scenario: Home page loads at Novamark
    When I navigate to "https://novamark.hubblehox.ai/"
    Then the URL should contain "https://novamark.hubblehox.ai/"
    When I click on "Forgot Password"
    Then the URL should contain "/sign-in"
    And I enter "arun.gounder@thecontrast.in" in the "Email ID" field
    And I click the "Send OTP" button