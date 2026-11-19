@must-fail @development
Feature: Assertions that must fail: the debug toolbar and the debug page, in development
  Each scenario asserts something that is not true on the test app while it runs in the development
  environment (MUST_FAIL_TAGS="@must-fail and @development"). Its steps before the last one pass; the
  last one must fail, with the message its description announces and a hint.

  Scenario: The debug toolbar taken for absent
    Fails with: Expected no debug toolbar, but the page has the script that loads it, its icon, its bar (/).
    Given I am an anonymous user
    When I go to the homepage
    Then I should not see the debug toolbar

  @js-off
  Scenario: The debug page taken for a plain error page
    Fails with: The page shows debug information: the exception class "RuntimeException"
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then the page should not show debug information

  Scenario: A tab the debug toolbar does not have
    Fails with: The debug toolbar has no "Mail" tab. Its tabs:
    Given I am an anonymous user
    When I go to "/login"
    And I open the "Mail" panel of the debug toolbar

  Scenario: A text the panel does not show
    Fails with: Expected the "Routes" panel of the debug toolbar to show "NoSuchController::nothing".
    Given I am an anonymous user
    When I go to "/login"
    And I open the "Routes" panel of the debug toolbar
    Then the "Routes" panel of the debug toolbar should show "NoSuchController::nothing"

  Scenario: A text the panel shows, taken for absent
    Fails with: Expected the "Routes" panel of the debug toolbar not to show "LoginController::loginView", but it does.
    Given I am an anonymous user
    When I go to "/login"
    And I open the "Routes" panel of the debug toolbar
    Then the "Routes" panel of the debug toolbar should not show "LoginController::loginView"

  Scenario: A panel that is not open
    Fails with: The "Auth" panel of the debug toolbar is not open.
    Given I am an anonymous user
    When I go to "/login"
    And I open the "Routes" panel of the debug toolbar
    Then the "Auth" panel of the debug toolbar should show "Session"

  Scenario: An app in development taken for a live one
    Fails with: Expected the page to say it runs in the "production" environment, but it says "development".
    Given I am an anonymous user
    When I go to the homepage
    Then the page should say it runs in the "production" environment
