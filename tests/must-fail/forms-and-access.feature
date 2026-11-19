@must-fail
Feature: Assertions that must fail: forms, messages, groups and permissions
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A field that holds another account's address
    Fails with: Expected the "Email Address" field to hold the email of "admin" ("admin@example.com"), but it holds "user@example.com".
    Given I am an anonymous user
    When I log in with the email "user@example.com" and the password "wrong-password"
    Then the "Email Address" field should hold the email of "admin"

  Scenario: The error of an unknown address, where the address is known
    Fails with: Expected the error message "Unable to log you in. Please check your credentials." (https://codeignitersteps.ddev.site/login). The error messages: "Unable to log you in. Please check your password.".
    Given I am an anonymous user
    When I log in with the email "user@example.com" and the password "wrong-password"
    Then I should see the error message "Unable to log you in. Please check your credentials."

  Scenario: An error message that is on the page
    Fails with: Expected not to see the error message "Unable to log you in. Please check your password.", but the page shows it
    Given I am an anonymous user
    When I log in with the email "user@example.com" and the password "wrong-password"
    Then I should not see the error message "Unable to log you in. Please check your password."

  Scenario: A success message where the page shows an error
    Fails with: Expected the success message "You have successfully logged out." (https://codeignitersteps.ddev.site/login). The page shows no success message. Other messages: error: "Unable to log you in. Please check your password.".
    Given I am an anonymous user
    When I log in with the email "user@example.com" and the password "wrong-password"
    Then I should see the success message "You have successfully logged out."

  Scenario: No error message, where the page shows one
    Fails with: Expected no error message, but the page shows: "Unable to log you in. Please check your password."
    Given I am an anonymous user
    When I log in with the email "user@example.com" and the password "wrong-password"
    Then I should not see any error message

  Scenario: A filled field taken for the empty one
    Fails with: Expected the "Email Address" field to block the form as empty. The fields the browser refuses: "Password"
    Given I am an anonymous user
    When I go to "/login"
    And I fill in "Email Address" with the email of "user"
    And I click the "Login" button
    Then the "Email Address" field should block submission as required

  Scenario: A page without a form has no security token to expire
    Fails with: No form of the page carries a security token (https://codeignitersteps.ddev.site/): no hidden field named like "csrf" or "token".
    Given I am an anonymous user
    When I go to the homepage
    And the security token of the form expires

  Scenario: An account of the user group taken for one of the admin group
    Fails with: Expected access to /admin, but it turned the browser away to / (a redirect (HTTP 302) to /).
    Given I am a logged in user with the "user" user
    Then I should have access to "/admin"

  Scenario: An account of the admin group taken for one without access
    Fails with: Expected no access to /admin, but it opened the page (HTTP 200).
    Given I am a logged in user with the "admin" user
    Then I should not have access to "/admin"

  Scenario: The permission taken for the group
    Fails with: The access to /settings differs for 1 of 2 rows: "admin": expected allowed, but it turned the browser away to / (a redirect (HTTP 302) to /).
    Then the access to "/settings" should be:
      | account   | access  |
      | developer | allowed |
      | admin     | allowed |
