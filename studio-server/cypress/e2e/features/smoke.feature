Feature: BDD pipeline smoke test
  As a developer setting up the automation kit
  I want to verify Cypress + Cucumber + esbuild work together
  So that future tests have a working foundation

  @smoke @phase1
  Scenario: Visiting example.com loads a known heading
    When I navigate to "https://example.com/"
    Then I should see "Example Domain"
    And the URL should contain "example.com"
