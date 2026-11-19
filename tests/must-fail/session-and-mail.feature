@must-fail
Feature: Assertions that must fail: the session and the mail
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A visitor taken for a signed-in account
    Fails with: Expected to be logged in, but /login shows the login form: nobody is signed in.
    Given I am an anonymous user
    Then I should be logged in

  Scenario: A signed-in account taken for a visitor
    Fails with: Expected nobody to be logged in, but the login page sent the browser on to /: somebody is signed in.
    Given I am a logged in user with the "user" user
    Then I should not be logged in

  Scenario: One account taken for another
    Fails with: Expected "admin" (admin@example.com, admin) to be logged in, but /account names "user@example.com".
    Given I am a logged in user with the "user" user
    Then I should be logged in as "admin"

  Scenario: The home page taken for the login form
    Fails with: Expected to see the login form, but it did not appear within
    Given I am an anonymous user
    When I go to the homepage
    Then I should see the login form

  Scenario: The login page taken for a page without the login form
    Fails with: Expected not to see the login form, but it is on the page.
    Given I am an anonymous user
    When I go to "/login"
    Then I should not see the login form

  Scenario: A banned account cannot log in
    Fails with: Could not log in as "banned" (banned@example.com): Can not log you in as you are currently banned.
    Given I am an anonymous user
    Given I am a logged in user with the "banned" user

  Scenario: A login form that refuses the account
    Fails with: The login form refused "banned" (banned@example.com): Can not log you in as you are currently banned.
    Given I am an anonymous user
    When I log in as "banned" with the login form

  Scenario: A session that ends when the browser has none
    Fails with: The browser has no session cookie of codeignitersteps.ddev.site to drop.
    Given I am an anonymous user
    And all cookies are cleared
    When my session expires

  Scenario: A mail the app did not send
    Fails with: No e-mail "Reset your password" to user@example.com arrived in the mailbox
    Given I am an anonymous user
    When I ask for a login link for "user"
    Then an email with the subject "Reset your password" should be sent to "user"

  Scenario: No mail, when the app sent one
    Fails with: Expected no e-mail to user@example.com, but the app sent: "Your Login Link".
    Given I am an anonymous user
    When I ask for a login link for "user"
    Then no email should be sent to "user"

  Scenario: A text the mail does not hold
    Fails with: The e-mail "Your Login Link" to user@example.com does not contain "Your password is".
    Given I am an anonymous user
    When I ask for a login link for "user"
    Then the email with the subject "Your Login Link" to "user" should contain "Your password is"

  Scenario: A link the mail does not have
    Fails with: The newest e-mail to user@example.com ("Your Login Link") has no link "Reset Password". Its links: "Login".
    Given I am an anonymous user
    When I ask for a login link for "user"
    And I open the "Reset Password" link of the email to "user"

  Scenario: A login form sent from another site taken for a real login
    Fails with: Expected to be logged in, but /login shows the login form: nobody is signed in.
    Given I am an anonymous user
    When I go to "/login"
    And a page of another site sends the login form of "user" to "/login"
    Then I should be logged in
