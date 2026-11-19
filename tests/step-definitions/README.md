# Step definitions

| File | Covers |
| --- | --- |
| `codeigniter-session.steps.js` | The session: login by a handle of the users registry (a session taken over when the account already has one), login through the form (remembered or not), login with an address and a password, logout, who is signed in, the login form, a session that expires, the login link asked for by mail. |
| `codeigniter-mail.steps.js` | The mail the app sends: that it arrived (or none did), what it says, a link of it opened as a person does. |
| `codeigniter-forms.steps.js` | Forms as a person reads them: a field filled with the address, user name or password of an account of the registry, a field that holds them, the error, success, warning and information messages of a page, a field the browser refuses as empty, a form whose security token is out of date. |
| `codeigniter-access.steps.js` | Groups and permissions: a page an account may open or not, and a table of who may open a page. |
| `codeigniter-pages.steps.js` | The framework's own pages: the welcome page and the environment it says, the error page of a status, the debug information a live app must not show, a login form sent from another site. |
| `codeigniter-toolbar.steps.js` | The debug toolbar of an app in development: that a page has it (or not), a panel opened, what a panel shows. |
| `codeigniter-helpers.js` | Shared plumbing: the wait budget, the answers on the way to a page, friendly errors, the paths of the app, the users registry, the session cache and the login, fields, the messages of a page, the mailbox of the test app, the status of the page. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No step phrase names the framework or a library. A name appears only as an
  argument a step asserts.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does: a label, a role, a text. The stable hooks
  of the pages (`role="alert"`, the contextual classes of a message, the name of
  a field, the ids of the debug toolbar) are the fallback.
- Wait on the page, never on a fixed time: on the locator, on the navigation a
  form or a link starts, on the requests of the page (`settle`).
- Fail with `friendly({ message, hint })`: what was expected, what was found
  and where to look.
- A step never creates or deletes a user: accounts are configuration, named in
  the `users` registry of `cucumber.js` and created by the build of the app.
- Open the page in a real browser before writing or changing its step, and
  write the step from what is there: the roles and names of the accessibility
  tree, the stable attributes, what the page does while it loads or saves.
- Give every assertion a scenario in `tests/must-fail/` that makes it fail.
