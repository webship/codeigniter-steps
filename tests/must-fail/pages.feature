@must-fail
Feature: Assertions that must fail: the pages of the framework
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A page of the app taken for the 404 page
    Fails with: Expected the 404 error page, but the browser shows HTTP 200, "Login"
    Given I am an anonymous user
    When I go to "/login"
    Then I should see the 404 error page

  @js-off
  Scenario: The 404 page taken for another page
    Fails with: Expected not to see the 404 error page, but the browser shows it (HTTP 404, "404 - Page Not Found", heading "404")
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should not see the 404 error page

  @js-off
  Scenario: The plain 500 page taken for the debug page
    Fails with: Expected the page to show debug information, but it shows none (HTTP 500, "Whoops!").
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then the page should show debug information

  Scenario: A live app taken for one in development
    Fails with: Expected the page to say it runs in the "development" environment, but it says "production".
    Given I am an anonymous user
    When I go to the homepage
    Then the page should say it runs in the "development" environment

  Scenario: A page without the environment line
    Fails with: The page does not say which environment the app runs in (/login): it has no "Environment:" line.
    Given I am an anonymous user
    When I go to "/login"
    Then the page should say it runs in the "production" environment

  Scenario: The login page taken for the welcome page
    Fails with: Expected the welcome page at /login, but it has no a main heading that starts with "Welcome to"
    Given I am an anonymous user
    When I go to "/login"
    Then I should see the welcome page

  Scenario: The welcome page taken for another page
    Fails with: Expected not to see the welcome page, but / shows it
    Given I am an anonymous user
    When I go to the homepage
    Then I should not see the welcome page

  Scenario: The debug toolbar on a live app
    Fails with: Expected to see the debug toolbar (its icon at the corner of the page, or its bar), but it did not appear within
    Given I am an anonymous user
    When I go to the homepage
    Then I should see the debug toolbar

  Scenario: A panel of the debug toolbar on a live app
    Fails with: The page has no debug toolbar (/).
    Given I am an anonymous user
    When I go to the homepage
    And I open the "Routes" panel of the debug toolbar
