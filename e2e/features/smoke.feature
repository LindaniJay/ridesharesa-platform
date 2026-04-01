Feature: RideShare web smoke regression

  Scenario: Terms page renders
    Given I open "/terms"
    Then I should see an h1 "Terms of Service"

  Scenario: Sign-in page renders
    Given I open "/sign-in"
    Then I should see text "Welcome back"
    And I should see an input of type "email"
    And I should see an input of type "password"
    And I should see a button with text "Sign in"

  Scenario: Resend confirmation requires email (negative)
    Given I open "/sign-in?checkEmail=1"
    When I click the button "Resend confirmation email"
    Then I should see text "Enter your email first, then resend confirmation."
