@development
Feature: The debug toolbar and the debug page, in development
  As a developer of the app
  I want the debug toolbar and the debug page while the app runs in development
  So that I see what a page did, and the checks for a live app see a real debug page

  # A lane of its own: the app runs in the development environment for it
  # (php spark env development) and in production again after (php spark env production).
  # The default run leaves this feature out (tags).

  Scenario: The pages of an app in development carry the debug toolbar
    Given I am an anonymous user
    When I go to the homepage
    Then I should see the welcome page
    And the page should say it runs in the "development" environment
    And I should see the debug toolbar

  Scenario: A panel of the debug toolbar shows what the page did
    Given I am an anonymous user
    When I go to "/login"
    And I open the "Routes" panel of the debug toolbar
    Then the "Routes" panel of the debug toolbar should show "LoginController::loginView"
    And the "Routes" panel of the debug toolbar should show "TestFixtures::account"
    When I open the "Config" panel of the debug toolbar
    Then the "Config" panel of the debug toolbar should show "Environment: development"
    And the "Config" panel of the debug toolbar should not show "Environment: production"

  Scenario: The auth panel of the debug toolbar names the signed-in account
    Given I am a logged in user with the "developer" user
    When I go to "/account"
    And I open the "Auth" panel of the debug toolbar
    Then the "Auth" panel of the debug toolbar should show "developer@example.com"

  @js-off
  Scenario: An error nothing catches shows the debug page, and the check sees it
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then the response status code should be 500
    And the page should show debug information
    And the page should say it runs in the "development" environment
    And I should not see the debug toolbar

  @js-off
  Scenario: An address the app does not have tells how it was routed
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should see the 404 error page
    And the page should show debug information

  @js-off
  Scenario: A form whose security token is out of date is refused with the 403 debug page
    Given I am an anonymous user
    When I go to "/login"
    And I fill in "Email Address" with the email of "user"
    And I fill in "Password" with the password of "user"
    And the security token of the form expires
    And I click the "Login" button
    Then I should see the 403 error page
    And I should see "The action you requested is not allowed."
