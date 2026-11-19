# Features

Reference features for the test app that `.github/scripts/build-ddev-site.sh`
builds: a new app made from the official app starter with the official auth
library, the pages the script adds (`/account`, `/admin`, `/settings` and
`/test-fixtures/server-error`), and the four accounts of `cucumber.js`
(`admin`, `developer`, `user`, `banned`). Copy a feature into your project and
replace the addresses, names and texts with those of your app.

| Feature | Covers |
| --- | --- |
| `session` | Logging in with the form, a wrong password, an address with no account, an address the app refuses, a banned account, an empty password, a page that needs a session (and back to it after the login), the session through a reload, the login page of a signed-in account, logging out, a remembered login that outlives the session, one that does not. |
| `login-link` | The login link by mail: the request, the mail, the link, the login; a link used twice; an address with no account; the way back to the login form. |
| `registration` | Registration refused: an address that is taken, a user name that is taken, a confirmation that differs, a password that is too short, a common password, an empty user name. No sign-up is completed. |
| `access` | Groups and permissions: who may open the admin area, the site settings and the account page; an account turned away; a visitor sent to the login form. |
| `forgery` | A login form sent from a page of another site; a login and a registration form whose security token is out of date. |
| `framework-pages` | The welcome page in production, no debug toolbar on a live app, the 404 and 500 pages with no debug information. |
| `accessibility` | An accessibility audit of the login, registration and login link pages, the account page and the welcome page. |
| `development` | `@development`, a lane of its own with the app in the development environment: the debug toolbar and its panels, the debug page, the 404 page that tells how it was routed, the 403 debug page of an out-of-date form. |

Scenarios that change something change it back: a login is ended by the
scenario that tests the logout, a login link a scenario asks for is the
scenario's own. No scenario creates or deletes a user or completes a
registration.
