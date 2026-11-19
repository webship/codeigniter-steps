@access
Feature: Groups and permissions
  As the owner of the app
  I want each page guarded for the groups and permissions it is meant for
  So that an account opens only what its group may open

  # The test app guards three pages with the filters of the auth library: /account (any signed-in
  # account), /admin (the "admin" and "superadmin" groups) and /settings (the "admin.settings"
  # permission, which the "developer" group has and the "admin" group has not).

  @critical
  Scenario: The admin area is open to the admin group only
    Then the access to "/admin" should be:
      | account   | access  |
      | admin     | allowed |
      | developer | denied  |
      | user      | denied  |
      | visitor   | login   |

  @critical
  Scenario: The site settings are open to the accounts with the permission, whatever their group
    Then the access to "/settings" should be:
      | account   | access  |
      | developer | allowed |
      | admin     | denied  |
      | user      | denied  |
      | visitor   | login   |

  Scenario: The account page is open to every signed-in account
    Then the access to "/account" should be:
      | account   | access  |
      | admin     | allowed |
      | developer | allowed |
      | user      | allowed |
      | visitor   | login   |

  Scenario: An account of the user group is turned away from the admin area
    Given I am a logged in user with the "user" user
    Then I should not have access to "/admin"
    And I should be on the homepage
    And I should have access to "/account"

  Scenario: An account of the admin group opens the admin area
    Given I am a logged in user with the "admin" user
    Then I should have access to "/admin"
    And I should see "Admin area"
    And I should not have access to "/settings"

  Scenario: A visitor is sent to the login form from a guarded page
    Given I am an anonymous user
    Then I should not have access to "/settings"
    And I should see the login form
