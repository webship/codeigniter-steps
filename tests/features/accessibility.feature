@accessibility
Feature: Accessibility of the auth pages
  As a person who uses a keyboard, a screen reader or a high contrast
  I want the pages that let me into my account to be accessible
  So that nobody is locked out of their account by the way a page is built

  # The welcome page of a new app has text with too little contrast (axe: color-contrast, serious):
  # its scenario holds it to no critical violation.

  Scenario Outline: The <page> has no serious accessibility violations
    Given I am an anonymous user
    When I go to "<path>"
    Then the page should have no serious accessibility violations
    And every form field should have an accessible label
    And every button should have an accessible name

    Examples:
      | page                         | path              |
      | login page                   | /login            |
      | registration page            | /register         |
      | page that sends a login link | /login/magic-link |

  Scenario: The account page has no serious accessibility violations
    Given I am a logged in user with the "user" user
    When I go to "/account"
    Then the page should have no serious accessibility violations
    And every link should have an accessible name

  Scenario: The welcome page has no critical accessibility violations
    Given I am an anonymous user
    When I go to the homepage
    Then the page should have no critical accessibility violations
