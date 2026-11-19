@login-link
Feature: The login link by mail
  As an account of the app that lost its password
  I want a link by mail that logs me in
  So that I get into my account without the password, once

  # The mail is read from the mail catcher of the test app (worldParameters.mailUrl).

  @critical
  Scenario: The link the app mails logs the account in
    Given I am an anonymous user
    When I ask for a login link for "user"
    Then I should see "Check your email!"
    And I should see "We just sent you an email with a Login link inside. It is only valid for 60 minutes."
    And an email with the subject "Your Login Link" should be sent to "user"
    And the email with the subject "Your Login Link" to "user" should contain "Username: user"
    When I open the "Login" link of the email to "user"
    Then I should be logged in as "user"

  Scenario: A link that was used is refused the second time
    Given I am an anonymous user
    When I ask for a login link for "developer"
    And I open the "Login" link of the email to "developer"
    Then I should be logged in as "developer"
    When I log out
    And I open the "Login" link of the email to "developer"
    Then I should be on "/login/magic-link"
    And I should see the error message "Unable to verify the link."
    And I should not be logged in

  Scenario: An address with no account gets no link
    Given I am an anonymous user
    When I ask for a login link for "nobody@example.com"
    Then I should see the error message "Unable to verify the email address"
    And no email should be sent to "nobody@example.com"

  Scenario: The page that sends a login link goes back to the login form
    Given I am an anonymous user
    When I go to "/login"
    And I click "Use a Login Link"
    Then I should be on "/login/magic-link"
    When I click "Back to Login"
    Then I should see the login form
