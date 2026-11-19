<p align="center"><img src="https://raw.githubusercontent.com/webship/codeigniter-steps/2.0.x/assets/logo.svg" alt="CodeIgniter logo" width="96"></p>

# codeigniter-steps

Cucumber step definitions for testing CodeIgniter apps with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

A framework ships no fixed pages, so `@webship-js/codeigniter-steps` targets the
pages most real apps start from: the ones the official app starter and the
official auth library (Shield) give every new app, and the ones the framework
itself answers with. That is the session (logging in and out, a banned
account, a session that expires and a login that is remembered past it), the
login link the app mails, registration (through its refusals), groups and
permissions (who may open a page), the error and success messages of a page,
a form sent from another site or with an out-of-date security token, the
welcome page and the environment the app says it runs in, the 404 and 500
pages, the check that a live app shows no debug information, and, while the
app runs in development, the debug toolbar and the debug page. The steps are
proven on an app made from the app starter 4.7 with the auth library 1.4.

No step phrase names the framework or a library: a scenario reads `Given I am a
logged in user with the "admin" user` and `Then I should have access to
"/admin"`.

CI builds a real app with [DDEV](https://ddev.com) on the runner, the way the
app starter's documentation makes it, on two PHP versions, and runs the whole
suite against each, twice, on every push and pull request, then the assertions
that must fail and the development lane; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. PHP, Composer and the database run in DDEV's containers.

**1. The app.** The pack's own build script (the one CI runs) makes a new app in a DDEV project (type `php`, docroot `public`) with Composer: the app starter (`composer create-project codeigniter4/appstarter`), then the auth library (`composer require codeigniter4/shield` and its own `spark shield:setup`). It turns on CSRF protection for every form, adds four pages (see [A test app](#a-test-app)), creates the accounts of [Test users](#test-users), and runs the app as a live app runs (`CI_ENVIRONMENT = production`). It takes about a minute.

```bash
git clone https://github.com/webship/codeigniter-steps.git
SITE_DIR="$PWD/codeigniter-app" codeigniter-steps/.github/scripts/build-ddev-site.sh
```

The app answers at `https://codeignitersteps.ddev.site` and its mailbox at `https://codeignitersteps.ddev.site:8026`.

In the [Webship Workspace](https://github.com/webship/workspace), its CodeIgniter plugin builds the app instead, with the same app starter and auth library, in a sites folder of the workspace (`test/` here; `dev/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require codeigniter --with-needs
bash core/scripts/plugins.sh --activate codeigniter --with-needs
bash core/scripts/plugins.sh --install codeigniter
bash test/cmd-codeigniter-project.sh mysite --install --add-users --shield --production
```

That app answers at `https://mysite.ddev.site` and its mailbox at `https://mysite.ddev.site:8026`. `--shield` adds the auth library with CSRF protection on, and `--production` runs the app as the script's app runs (the plain error pages and no debug toolbar). Its accounts are the plugin's: `admin`, `developer`, `user` and `banned`, the same names, groups and addresses as the script's, with the workspace's shared password `dD.123123ddd` (step 3 names them). It has none of the four pages the script adds, which the features of [`tests/features/`](tests/features/) open (the account page, the admin area, the site settings and an error nothing catches); this adds them, from the workspace folder:

```bash
git clone https://github.com/webship/codeigniter-steps.git
cp codeigniter-steps/site/TestFixtures.php test/mysite/app/Controllers/TestFixtures.php
cp codeigniter-steps/site/test_fixtures.php test/mysite/app/Views/test_fixtures.php
cat codeigniter-steps/site/routes.php >> test/mysite/app/Config/Routes.php
```

With them, the features of [`tests/features/`](tests/features/) pass there as they pass on the script's app.

**2. A test project.**

```bash
mkdir codeigniter-tests && cd codeigniter-tests
npm init -y
npm install --save-dev webship-js @webship-js/codeigniter-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the tags that keep the lanes out of a normal run, the address of the app and of its mailbox, and the accounts (the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/codeigniter-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress, the assertions that must fail, and the lane that needs the app in the
    // development environment (@development) stay out of a normal run.
    tags: 'not @wip and not @must-fail and not @development',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://codeignitersteps.ddev.site',
      mailUrl: (process.env.LAUNCH_URL || 'https://codeignitersteps.ddev.site') + ':8026',
      // A page that names the signed-in account (the test app adds /account).
      accountPath: '/account',
      reuseSessions: true,
      // The browser logs every error page as "Failed to load resource: the server responded with a
      // status of 404" (403, 500): not a fault of the app. The scenarios that open an error page
      // carry @js-off, so the warning mode below stays on for every other page.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        admin: { email: 'admin@example.com', username: 'admin', password: 'Account-Pass-2026!' },
        developer: { email: 'developer@example.com', username: 'developer', password: 'Account-Pass-2026!' },
        user: { email: 'user@example.com', username: 'user', password: 'Account-Pass-2026!' },
        banned: { email: 'banned@example.com', username: 'banned', password: 'Account-Pass-2026!' },
      },
    },
  },
};
```

On an app from the Webship Workspace (step 1), the accounts are the plugin's: the same four, each with the password `dD.123123ddd` (`admin: { email: 'admin@example.com', username: 'admin', password: 'dD.123123ddd' }`, and so on), and `mailUrl` follows `LAUNCH_URL`. Its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: An account logs in
    Given I am a logged in user with the "user" user
    Then I should be logged in

  @js-off
  Scenario: An address the app does not have answers with the 404 page
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should see the 404 error page
    And the page should not show debug information
```

**5. Run it.** Set `LAUNCH_URL` to the address of the app: `https://codeignitersteps.ddev.site` for the build script's app, `https://mysite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://codeignitersteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
8 steps (8 passed)
0m04.314s (executing steps: 0m04.283s)
[webship-js] HTML report → …/codeigniter-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/codeigniter-steps/tests/features/`): together they use every step of the pack. They read no file of their own; they open the four pages of [A test app](#a-test-app).

### What the suite tests

The features of this repository run every step of the pack against the test app, twice in a row in CI on every change, then the assertions that must fail, then a lane with the app in development: logging in with the form, a wrong password, an address with no account, an address the browser takes and the app refuses, a banned account, an empty password, a page that needs a session (and back to it after the login), the session through a reload, the login page of a signed-in account, logging out, a remembered login that outlives the session and is ended by a logout, a login that was not remembered; the login link from the request to the mail, the link and the login, a link used twice, an address with no account; registration refused for an address or a user name that is taken, a confirmation that differs, a short or a common password, an empty user name; who may open the admin area (a group), the site settings (a permission) and the account page; a login form sent from another site, and a login and a registration form whose security token is out of date; the welcome page and the production environment, no debug toolbar on a live app, the 404 and 500 pages with no debug information; an accessibility audit of the auth pages, the account page and the welcome page; and in development (`@development`) the debug toolbar and its panels, the debug page, the 404 page that tells how it was routed and the 403 debug page of an out-of-date form.

Not tested: completing a registration (the suite never creates an account), the email activation and two-factor actions of the auth library (off on a new app, and an account left half way through either would break every later login), the limit on requests to the auth pages (the `auth-rates` filter the library recommends: the whole suite runs from one address), the access tokens and the API authenticators, and the pages an app adds of its own.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- An app made from the official app starter with the official auth library, and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/codeigniter-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/codeigniter-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the app and name the accounts the suite logs in with
   (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-app.ddev.site',
     loginPath: '/login',                  // the login page
     logoutPath: '/logout',                // the address that ends a session, for a page with no "Log out" link
     loginLinkPath: '/login/magic-link',   // the page that mails a login link
     accountPath: '/account',              // a page that names the signed-in account
     mailUrl: 'https://your-app.ddev.site:8026', // the mailbox of the app (Mailpit), for the mail steps
     users: {
       admin: { email: 'admin@example.com', username: 'admin', password: process.env.ADMIN_PASSWORD },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the addresses, names and texts with those of your app.

```gherkin
Feature: Groups and permissions

  Scenario: The admin area is open to the admin group only
    Then the access to "/admin" should be:
      | account   | access  |
      | admin     | allowed |
      | developer | denied  |
      | user      | denied  |
      | visitor   | login   |
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `codeigniter-session.steps.js` | 9 | Login by a handle of the users registry (a session taken over when the account already has one), login through the form (remembered or not), login with an address and a password, logout, who is signed in, the login form, a session that expires, the login link asked for by mail. |
| `codeigniter-mail.steps.js` | 4 | The mail the app sends (subject, text, no mail), a link of a mail opened as a person does. |
| `codeigniter-forms.steps.js` | 6 | A field filled with the address, user name or password of an account of the registry, a field that holds them, the error, success, warning and information messages of a page (or none), a field the browser refuses as empty, a form whose security token is out of date. |
| `codeigniter-access.steps.js` | 2 | A page an account may open or not, and a table of who may open a page. |
| `codeigniter-pages.steps.js` | 5 | The error page of a status, the debug information a live app must not show, a login form sent from another site, the welcome page, the environment the page says. |
| `codeigniter-toolbar.steps.js` | 3 | The debug toolbar (or none), a panel of it opened, what a panel shows. |
| `codeigniter-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait budget, the answers on the way to a page, friendly errors, the users registry, the session cache and the login, fields, the messages of a page, the mailbox, the status of the page. It registers no step. |

Text, links, the plain filling of fields, buttons, cookies, the status code of
a page and the accessibility audit are webship-js's own steps (`I should see
"..."`, `I fill in "..." with "..."`, `I click the "..." button`, `a cookie with
the name "remember" should exist`, `the response status code should be 404`,
`the page should have no serious accessibility violations`): this pack adds
only what the app decides.

## How the steps find things and wait

- **By what a person reads.** A field is found by its label, else its name; a
  message by its text and its kind; a tab of the debug toolbar by the word of
  its label; a link of a mail by the text of its button. The stable hooks of
  the pages are the fallback: the `name` of a field, `role="alert"` and the
  contextual classes of a message box (`alert-danger` holds errors,
  `alert-success` successes), the ids of the debug toolbar (`#debug-icon`,
  `#debug-bar`, `data-tab`).
- **Messages line by line.** A refused form shows its errors in one box, one
  per line; `I should see the error message "..."` reads each line.
- **Who may open a page.** The app guards a page with a filter of its auth
  library (a session, a group, a permission). The access steps open the page
  and read what the app did with it: the page itself (allowed), the login form
  (a visitor), or a redirect away or HTTP 401 or 403 (denied). A new app turns
  a refused account away to its home page with no message, so the steps read
  the redirect, not a text.
- **Who is signed in.** The app sends a signed-in account away from its login
  page and shows the form to a visitor: `I should be logged in` reads that.
  `I should be logged in as "..."` reads a page that names the account
  (`worldParameters.accountPath`).
- **No fixed sleeps.** The steps wait on the page's own signals: the
  navigation a form or a link starts and the page it ends on, the requests of
  the page, the message that appears.
- **Failures say what was found.** `Expected access to /admin, but it turned
  the browser away to / (a redirect (HTTP 302) to /).` with a hint on where to
  look.

## Accounts

The suite never creates or deletes a user. Accounts are configuration: list
the ones the app has in `worldParameters.users`, by a handle the scenarios
use, each with its `email`, `username` and `password`.

```javascript
users: {
  admin: { email: 'admin@example.com', username: 'admin', password: process.env.ADMIN_PASSWORD },
  user: { email: 'user@example.com', username: 'user', password: process.env.USER_PASSWORD },
},
```

An account that logged in once keeps its session for the rest of the run: a
later scenario that logs in as the same handle takes the session over instead
of filling in the login form again. That is quicker. If the app limits the
requests to its auth pages (the auth library's `auth-rates` filter), a login
that meets the limit waits the time the app gives, once.
`reuseSessions: false` in `worldParameters` turns the reuse off.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; the `*_EMAIL`,
`*_USERNAME` and `*_PASSWORD` variables replace them).
[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
creates them on the local test app, and CI does the same on the runner. They are
placeholder credentials of that throwaway app, not of any real one.

```json
{
  "admin": { "email": "admin@example.com", "username": "admin", "password": "Account-Pass-2026!" },
  "developer": { "email": "developer@example.com", "username": "developer", "password": "Account-Pass-2026!" },
  "user": { "email": "user@example.com", "username": "user", "password": "Account-Pass-2026!" },
  "banned": { "email": "banned@example.com", "username": "banned", "password": "Account-Pass-2026!" }
}
```

`admin` is in the "admin" group, `developer` in the "developer" group (which
has the "admin.settings" permission and the "admin" group has not), `user` in
the "user" group a new account gets, and `banned` in the "user" group, banned:
the app refuses its login.

## A test app

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the app the suite of this repository runs against, the documented way:
a DDEV project of type `php` with the `public` docroot (DDEV has no project type
of its own for the framework) and Node.js 24, the app starter made with
Composer in the web container, its `.env` (the address, the database DDEV gives
the project, the sender of its mail), the auth library set up by its own
`spark shield:setup`. The app sends its mail through the sendmail of the web
container, which DDEV hands to its mail catcher. Then:

- CSRF protection for every form: the `csrf` filter that the app starter ships
  commented out in `app/Config/Filters.php`, turned on;
- four pages ([`site/`](site/)), guarded the way the auth library's guide
  guards an app's pages: `/account` (any signed-in account, filter `session`),
  `/admin` (filter `group:admin,superadmin`), `/settings` (filter
  `permission:admin.settings`), and `/test-fixtures/server-error`, an error
  nothing catches (a new app has no page that needs a session, no page for a
  group or a permission, and no page that fails, and the suite must see each);
- the accounts of [Test users](#test-users), written through the app's own user
  model by a seeder ([`site/TestAccounts.php`](site/TestAccounts.php));
- `CI_ENVIRONMENT = production` (`spark env production`), as a live app runs:
  an error renders the plain error page, never the debug page, and the pages
  carry no debug toolbar.

```bash
SITE_DIR="$PWD/../codeigniter-app" .github/scripts/build-ddev-site.sh
npm test
```

Nothing is installed that the app starter and the auth library do not bring:
no paid package, no trial, no sign-in to any service.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `codeigniter-session.steps.js` (9)

- `Given I am a logged in user with the "admin" user`
- `When I log in as "user" with the login form and ask to be remembered`
- `When I log in with the email "user@example.com" and the password "wrong-password"`
- `When I log out`
- `Then I should be logged in`
- `Then I should be logged in as "user"`
- `Then I should see the login form`
- `When my session expires`
- `When I ask for a login link for "user"`

### `codeigniter-mail.steps.js` (4)

- `Then an email with the subject "Your Login Link" should be sent to "user"`
- `Then no email should be sent to "nobody@example.com"`
- `Then the email with the subject "Your Login Link" to "user" should contain "Username: user"`
- `When I open the "Login" link of the email to "user"`

### `codeigniter-forms.steps.js` (6)

- `When I fill in "Password" with the password of "user"`
- `Then the "Email Address" field should hold the email of "user"`
- `Then I should see the error message "Unable to log you in. Please check your password."`
- `Then I should not see any error message`
- `Then the "Username" field should block submission as required`
- `When the security token of the form expires`

### `codeigniter-access.steps.js` (2)

- `Then I should have access to "/admin"`
- `Then the access to "/admin" should be:` (a table of `account` and `access`)

### `codeigniter-pages.steps.js` (5)

- `Then I should see the 404 error page`
- `Then the page should not show debug information`
- `When a page of another site sends the login form of "user" to "/login"`
- `Then I should see the welcome page`
- `Then the page should say it runs in the "production" environment`

### `codeigniter-toolbar.steps.js` (3)

- `Then I should see the debug toolbar`
- `When I open the "Routes" panel of the debug toolbar`
- `Then the "Routes" panel of the debug toolbar should show "TestFixtures::account"`

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../codeigniter-app" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the app
npm run test:must-fail     # assertions that must fail, each with its message
```

The development lane needs the app in the development environment, and puts
it back:

```bash
(cd ../codeigniter-app && ddev exec php spark env development)
npm run test:development   # the debug toolbar, the debug page
MUST_FAIL_TAGS="@must-fail and @development" npm run test:must-fail
(cd ../codeigniter-app && ddev exec php spark env production)
```

`LAUNCH_URL` points the suite at another app; `npx cucumber-js
tests/features/session.feature` runs one feature and `npx cucumber-js
tests/features/session.feature:<line>` one scenario (the line of its
`Scenario:`; the paths of `cucumber.js` are left out when the command line
names any); `FEATURES` runs a subset too
(`FEATURES=tests/features/session.feature npm test`); `CUCUMBER_TAGS=@critical`
runs the smoke lane; `HEADLESS=false` shows the browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test app. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing.

The suite leaves the app as it found it: it changes no account, completes no
registration, and every login link a scenario asks for is the scenario's own.
A run stopped half way changes nothing either; the build script gives the
accounts back their name, address, password, groups and state without
building anything:

```bash
ACCOUNTS_ONLY=1 SITE_DIR="$PWD/../codeigniter-app" .github/scripts/build-ddev-site.sh
```

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable attributes, what the page does while it loads or saves, the exact
messages. The steps are proven on the app starter 4.7 with the auth library
1.4, on PHP 8.2 and 8.4, in English, with Chromium.

Not covered: completing a registration, the email activation and two-factor
actions, the limit on requests to the auth pages, the access tokens and API
authenticators, and an app's own pages.

## License

MIT

## Logo

The CodeIgniter logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The CodeIgniter name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
