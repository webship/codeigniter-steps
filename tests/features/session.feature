@session
Feature: The session
  As an account of the app
  I want to log in, stay logged in, and log out
  So that only I use my account, and only while I mean to

  @critical
  Scenario: An account logs in with the login form and lands on the home page
    Given I am an anonymous user
    When I log in as "user" with the login form
    Then I should be on the homepage
    And I should see the welcome page
    And I should be logged in as "user"

  Scenario: A wrong password is refused with the error message of the login page
    Given I am an anonymous user
    When I log in with the email "user@example.com" and the password "wrong-password"
    Then I should see the login form
    And I should see the error message "Unable to log you in. Please check your password."
    And the "Email Address" field should hold the email of "user"
    And I should not be logged in

  Scenario: An address with no account is refused
    Given I am an anonymous user
    When I log in with the email "nobody@example.com" and the password "wrong-password"
    Then I should see the error message "Unable to log you in. Please check your credentials."
    And I should not be logged in

  Scenario: An address the browser takes but the app does not is refused by the app
    Given I am an anonymous user
    When I log in with the email "a@b" and the password "wrong-password"
    Then I should see the error message "The Email Address field must contain a valid email address."
    And I should not see the error message "Unable to log you in. Please check your credentials."

  Scenario: A banned account is refused
    Given I am an anonymous user
    When I go to "/login"
    And I fill in "Email Address" with the email of "banned"
    And I fill in "Password" with the password of "banned"
    And I click the "Login" button
    Then I should see the error message "Can not log you in as you are currently banned."
    And I should not be logged in

  Scenario: An empty password is refused by the browser before anything is sent
    Given I am an anonymous user
    When I go to "/login"
    And I fill in "Email Address" with the email of "user"
    And I click the "Login" button
    Then the "Password" field should block submission as required
    And I should be on "/login"

  @critical
  Scenario: A page that needs a session sends a visitor to the login form, and the login back to it
    Given I am an anonymous user
    When I go to "/account"
    Then I should see the login form
    When I fill in "Email Address" with the email of "user"
    And I fill in "Password" with the password of "user"
    And I click the "Login" button
    Then I should be on "/account"
    And I should see "Signed in as user"

  Scenario: The session holds through a reload and a page of the app
    Given I am a logged in user with the "developer" user
    When I go to "/account"
    And I reload the page
    Then I should see "Signed in as developer"
    And I should be logged in as "developer"

  Scenario: The login page sends an account that is logged in on to the home page
    Given I am a logged in user with the "user" user
    When I go to "/login"
    Then I should not see the login form
    And I should be on the homepage

  @critical
  Scenario: Logging out ends the session and says so
    Given I am an anonymous user
    When I log in as "user" with the login form
    And I go to "/account"
    And I log out
    Then I should see the login form
    And I should see the success message "You have successfully logged out."
    And I should not be logged in

  # Logging out leaves the "remember" cookie in the browser, but the app forgets its token: it logs
  # nobody in any more.
  Scenario: A remembered login outlives the session, and logging out ends it for good
    Given I am an anonymous user
    When I log in as "user" with the login form and ask to be remembered
    Then a cookie with the name "remember" should exist
    When my session expires
    Then I should be logged in
    And I should be logged in as "user"
    When I log out
    And my session expires
    Then I should not be logged in

  Scenario: A login that was not remembered ends with the session
    Given I am an anonymous user
    When I log in as "user" with the login form
    Then a cookie with the name "remember" should not exist
    When my session expires
    Then I should not be logged in
