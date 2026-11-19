@forgery
Feature: Forms sent from elsewhere, and out of date
  As an account of the app
  I want the app to take a form only from its own pages, with a token it issued
  So that another site cannot act for me, and an old form cannot be replayed

  @critical
  Scenario: A login form sent from a page of another site does not log the browser in
    Given I am an anonymous user
    When I go to "/login"
    And a page of another site sends the login form of "user" to "/login"
    Then I should not be logged in

  Scenario: A login form whose security token is out of date is refused
    Given I am an anonymous user
    When I go to "/login"
    And I fill in "Email Address" with the email of "user"
    And I fill in "Password" with the password of "user"
    And the security token of the form expires
    And I click the "Login" button
    Then I should be on "/login"
    And I should see the error message "The action you requested is not allowed."
    And I should not be logged in

  Scenario: A registration form whose security token is out of date is refused
    Given I am an anonymous user
    When I go to "/register"
    And I fill in "Email Address" with the email of "user"
    And I fill in "Username" with "new.person"
    And I fill in "Password" with "Strong-Pass-2026!"
    And I fill in "Password (again)" with "Strong-Pass-2026!"
    And the security token of the form expires
    And I click the "Register" button
    Then I should be on "/register"
    And I should see the error message "The action you requested is not allowed."
    And I should not see the error message "The Email Address field must contain a unique value."
