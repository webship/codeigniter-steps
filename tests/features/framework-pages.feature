@framework-pages
Feature: The pages of the framework
  As the owner of a live app
  I want the framework's own pages to answer as a live app's should
  So that visitors see a plain page, and nobody learns how the app is built

  # The browser logs every error page as a resource that failed to load: the scenarios that open
  # one carry @js-off.

  @critical
  Scenario: A new app shows its welcome page at its home address, in production
    Given I am an anonymous user
    When I go to the homepage
    Then the response status code should be 200
    And I should see the welcome page
    And I should see "The small framework with powerful features"
    And the page should say it runs in the "production" environment
    And I should not see the debug toolbar

  Scenario: The pages of a live app carry no debug toolbar
    Given I am a logged in user with the "user" user
    When I go to "/account"
    Then I should not see the debug toolbar
    When I go to "/login"
    Then I should not see the debug toolbar

  @critical @js-off
  Scenario: An address the app does not have answers with the 404 page
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should see the 404 error page
    And the response status code should be 404
    And I should see "Sorry! Cannot seem to find the page you were looking for."
    And the page should not show debug information

  @critical @js-off
  Scenario: An error nothing catches shows the 500 page and no debug information
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then I should see the 500 error page
    And the page should not show debug information
    And I should not see "The test app raised this error on purpose."
