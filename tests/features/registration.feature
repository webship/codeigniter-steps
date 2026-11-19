@registration
Feature: Registration, through its refusals
  As the owner of the app
  I want the registration form to refuse what it must
  So that no account is made with a taken address or name, or a weak password

  # A suite never makes an account: every scenario sends the address of an account the app already
  # has, so even a form the app took by mistake would make nothing.

  Background:
    Given I am an anonymous user
    And I am on "/register"

  @critical
  Scenario: An address that is taken is refused
    When I fill in "Email Address" with the email of "user"
    And I fill in "Username" with "new.person"
    And I fill in "Password" with "Strong-Pass-2026!"
    And I fill in "Password (again)" with "Strong-Pass-2026!"
    And I click the "Register" button
    Then I should be on "/register"
    And I should see the error message "The Email Address field must contain a unique value."
    And the "Email Address" field should hold the email of "user"
    And I should not be logged in

  Scenario: A user name that is taken is refused
    When I fill in "Email Address" with the email of "admin"
    And I fill in "Username" with the username of "user"
    And I fill in "Password" with "Strong-Pass-2026!"
    And I fill in "Password (again)" with "Strong-Pass-2026!"
    And I click the "Register" button
    Then I should see the error message "The Username field must contain a unique value."
    And the "Username" field should hold the username of "user"

  Scenario: A confirmation that differs from the password is refused
    When I fill in "Email Address" with the email of "user"
    And I fill in "Username" with "new.person"
    And I fill in "Password" with "Strong-Pass-2026!"
    And I fill in "Password (again)" with "Other-Pass-2026!"
    And I click the "Register" button
    Then I should see the error message "The Password (again) field does not match the Password field."

  Scenario: A password that is too short is refused
    When I fill in "Email Address" with the email of "user"
    And I fill in "Username" with "new.person"
    And I fill in "Password" with "abc"
    And I fill in "Password (again)" with "abc"
    And I click the "Register" button
    Then I should see the error message "Passwords must be at least 8 characters long."

  Scenario: A common password is refused
    When I fill in "Email Address" with the email of "user"
    And I fill in "Username" with "new.person"
    And I fill in "Password" with "password123"
    And I fill in "Password (again)" with "password123"
    And I click the "Register" button
    Then I should see the error message "Password must not be a common password."

  Scenario: An empty user name is refused by the browser before anything is sent
    When I fill in "Email Address" with the email of "user"
    And I fill in "Password" with "Strong-Pass-2026!"
    And I fill in "Password (again)" with "Strong-Pass-2026!"
    And I click the "Register" button
    Then the "Username" field should block submission as required
    And I should not see any error message
