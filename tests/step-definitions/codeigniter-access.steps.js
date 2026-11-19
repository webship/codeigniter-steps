'use strict';

// Groups and permissions, as a person meets them: a page an account may open,
// and a page the app turns it away from. The app guards a page with the
// filters of its auth library (a group, a permission, or a session); what the
// browser sees is the outcome: the page itself, the login form for a visitor,
// or a refusal (a redirect away from the page, or HTTP 401 or 403).

const { Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  clean,
  siteUrl,
  loginPath,
  pathOf,
  open,
  documentStatus,
  loginForm,
  logInAs,
} = require('./codeigniter-helpers');

/**
 * Open a page and say what the app did with it: "allowed" (the page itself),
 * "login" (a visitor sent to the login form), "denied" (sent elsewhere, or
 * answered with HTTP 401 or 403), or "error" (any other error status).
 *
 * @returns {Promise<{access: string, path: string, status: (number|null), where: string, how: string}>}
 */
async function access(world, path) {
  const answers = await open(world, siteUrl(world, path));
  const asked = pathOf(siteUrl(world, path));
  const where = pathOf(world.page.url());
  const status = await documentStatus(world);
  const first = answers[0];
  const how = first && first.status >= 300 && first.status < 400
    ? `a redirect (HTTP ${first.status}) to ${pathOf(first.location || world.page.url())}`
    : `HTTP ${status === null ? '(unknown)' : status}`;
  let result;
  if (where !== asked && (where === pathOf(loginPath(world)) || (await loginForm(world).isVisible().catch(() => false)))) result = 'login';
  else if (where !== asked || status === 401 || status === 403) result = 'denied';
  else if (status && status >= 400) result = 'error';
  else result = 'allowed';
  return { access: result, path: asked, status, where, how };
}

/** What an outcome reads like in a failure message. */
function told(outcome) {
  switch (outcome.access) {
    case 'allowed': return `it opened the page (${outcome.how})`;
    case 'login': return `it sent the browser to the login form (${outcome.how})`;
    case 'denied': return outcome.where !== outcome.path ? `it turned the browser away to ${outcome.where} (${outcome.how})` : `it refused the page (${outcome.how})`;
    default: return `the page answered ${outcome.how}`;
  }
}

/**
 * Open a page and assert that the account in the browser may, or may not,
 * open it. Allowed: the browser stays on the page and it answers without an
 * error. Not allowed: the app sends the browser elsewhere (the login form for
 * a visitor, another page for an account without the group or the
 * permission) or answers HTTP 401 or 403.
 *
 * Example #1: Then I should have access to "/admin"
 * Example #2: Then I should not have access to "/admin"
 * Example #3: And we should have access to "/settings"
 * Example #4: Then I should not have access to "/settings"
 * Example #5: But we should not have access to "/account"
 */
Then(/^(I |we )*should( not)* have access to "([^"]*)"$/, async function (pronounCase, notCase, path) {
  const outcome = await access(this, path);
  if (notCase && outcome.access === 'allowed') {
    throw friendly({ message: `Expected no access to ${outcome.path}, but ${told(outcome)}.`, hint: 'The app guards a page with a filter of its auth library (a group, a permission, or a session): check the filter of the route and the groups of the account.' });
  }
  if (!notCase && outcome.access !== 'allowed') {
    throw friendly({ message: `Expected access to ${outcome.path}, but ${told(outcome)}.`, hint: 'Log in as an account of a group the page lets in (I am a logged in user with the "..." user).' });
  }
  if (notCase && outcome.access === 'error') {
    throw friendly({ message: `Expected the app to turn the browser away from ${outcome.path}, but ${told(outcome)}: that is an error, not a refusal.`, hint: 'Check the address: a refusal is a redirect, or HTTP 401 or 403.' });
  }
});

const ACCESS = { allowed: 'allowed', denied: 'denied', login: 'login', 'login form': 'login' };

/**
 * Assert who may open a page, row by row: an account of the users registry
 * (by its handle), or "visitor" for a browser that is signed in as nobody,
 * and what the app does with it: "allowed" (the page opens), "denied" (the
 * app turns the account away, or answers HTTP 401 or 403) or "login" (a
 * visitor is sent to the login form). Every row is checked, and the failure
 * lists every row that differs.
 *
 * Example #1: Then the access to "/admin" should be:
 * Example #2: Then the access to "/settings" should be:
 * Example #3: And the access to "/account" should be:
 * Example #4: Then the access to "/admin" should be:
 * Example #5: And the access to "/settings" should be:
 */
Then(/^the access to "([^"]*)" should be:$/, { timeout: 300000 }, async function (path, table) {
  const rows = table.hashes();
  if (!rows.length || !('account' in rows[0]) || !('access' in rows[0])) {
    throw friendly({ message: 'The table needs the columns "account" and "access", and a row per account.', hint: '| account | access |  then rows such as  | admin | allowed |, | user | denied |, | visitor | login |.' });
  }
  const wrong = [];
  for (const row of rows) {
    const account = clean(row.account);
    const wanted = ACCESS[clean(row.access).toLowerCase()];
    if (!wanted) {
      throw friendly({ message: `"${row.access}" is not an access the table knows (row "${account}").`, hint: 'Use "allowed", "denied" or "login".' });
    }
    if (account === 'visitor') {
      await this.page.context().clearCookies();
    } else {
      await logInAs(this, account);
    }
    const outcome = await access(this, path);
    if (outcome.access !== wanted) wrong.push(`"${account}": expected ${wanted}, but ${told(outcome)}`);
  }
  await this.page.context().clearCookies();
  if (wrong.length) {
    throw friendly({ message: `The access to ${pathOf(siteUrl(this, path))} differs for ${wrong.length} of ${rows.length} rows: ${wrong.join('; ')}.`, hint: 'The app guards a page with a filter of its auth library: check the filter of the route and the groups and permissions of each account.' });
  }
});
