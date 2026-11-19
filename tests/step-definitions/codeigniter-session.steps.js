'use strict';

// The session: logging in by a handle of the users registry or by an address
// and a password, logging out, who is signed in, the login form, a session
// that ends while a remembered login stays, and the login link the app mails.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and created once by the build of the app. A
// feature never creates or deletes users.
//
// Every assertion waits on the page (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout.

const { Before, Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  escapeRegExp,
  siteUrl,
  loginPath,
  logoutPath,
  loginLinkPath,
  accountPath,
  currentPath,
  isOnPath,
  afterNavigation,
  open,
  assertPresence,
  resolveUser,
  addressOf,
  findField,
  documentStatus,
  loginForm,
  LOGIN_HINT,
  loginThroughTheForm,
  submitLogin,
  signedIn,
  logInAs,
  forgetSession,
} = require('./codeigniter-helpers');

// A mail step reads the mail that arrived since the scenario started, or since
// the step of this pack that asked for mail (a login link): never a mail of an
// earlier scenario or run.
Before(function () {
  this.__mailAskedAt = 0;
  this.__scenarioStartedAt = Date.now();
});

/**
 * Log in as an account of the users registry (`worldParameters.users` in
 * cucumber.js), by its handle. An account that logged in earlier in the run
 * takes its session over; otherwise the step logs in through the login form.
 * The browser ends on the page the app shows after a login (the home page, or
 * the page a visitor was sent to the login form from).
 *
 * Example #1: Given I am a logged in user with the "admin" user
 * Example #2: Given we are a logged in user with the "developer" user
 * Example #3: Given I am a logged in user with "user"
 * Example #4: And I am a logged in user with the "user" user
 * Example #5: Given we are a logged in user with the "admin" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await logInAs(this, handle);
});

/**
 * Log in through the login form as an account of the users registry, as a
 * person does: a new session, never one taken over. For the scenarios that
 * test the form itself; the step fails when the app refuses the login. "and
 * ask to be remembered" ticks the "Remember me?" box first.
 *
 * Example #1: When I log in as "user" with the login form
 * Example #2: When we log in as "admin" with the login form
 * Example #3: When I log in as "user" with the login form and ask to be remembered
 * Example #4: And I log in as "developer" with the login form
 * Example #5: When we log in as "user" with the login form and ask to be remembered
 */
When(/^(I |we )*log in as "([^"]*)" with the login form( and ask to be remembered)?$/, { timeout: 120000 }, async function (pronounCase, handle, rememberCase) {
  const user = resolveUser(this, handle);
  const outcome = await loginThroughTheForm(this, user, { remember: !!rememberCase });
  if (outcome.error) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.email}): ${outcome.error}`,
      hint: 'Check the address and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
});

/**
 * Send the login form with an address and a password. The step does not
 * expect the login to succeed: assert the outcome with the next step (the
 * error message of the login page, the page the app sends a signed-in
 * account to).
 *
 * Example #1: When I log in with the email "user@example.com" and the password "wrong-password"
 * Example #2: When we log in with the email "nobody@example.com" and the password "Whatever-123!"
 * Example #3: When I log in with the email "banned@example.com" and the password "wrong-password"
 * Example #4: And I log in with the email "a@b" and the password "wrong-password"
 * Example #5: When we log in with the email "no-such-account@example.org" and the password "Nothing-at-all-1!"
 */
When(/^(I |we )*log in with the email "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, email, password) {
  await submitLogin(this, { email, password });
});

/**
 * Log out as a person does: the "Log out" (or "Logout", "Sign out") link or
 * button of the page; on a page that offers none, the logout address of the
 * app (`worldParameters.logoutPath`, /logout). The session ends on the
 * server, so no later scenario takes it over.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, async function (pronounCase) {
  const page = this.page;
  forgetSession(this);
  const names = /^\s*(log ?out|sign ?out)\s*$/i;
  const control = page.getByRole('link', { name: names }).or(page.getByRole('button', { name: names })).filter({ visible: true });
  if (await control.count()) {
    await afterNavigation(this, () => control.first().click());
  } else {
    await open(this, siteUrl(this, logoutPath(this)));
  }
  if (await loginForm(this).isVisible().catch(() => false)) return;
  if (isOnPath(this, logoutPath(this))) {
    throw friendly({ message: `Logging out stopped at ${this.page.url()} (HTTP ${await documentStatus(this)}).`, hint: 'The app ends a session at its logout address (worldParameters.logoutPath, /logout) and sends the browser on to the login page.' });
  }
});

/**
 * Assert that somebody is, or nobody is, logged in. The step opens the login
 * page (`loginPath`, /login): the app sends a signed-in account away from it,
 * and shows its form to a visitor.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: Then we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: But I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const yes = await signedIn(this);
  if (notCase && yes) {
    throw friendly({ message: `Expected nobody to be logged in, but the login page sent the browser on to ${currentPath(this)}: somebody is signed in.`, hint: 'Log out first (I log out), or start from a new visitor (I am an anonymous user).' });
  }
  if (!notCase && !yes) {
    throw friendly({ message: `Expected to be logged in, but ${loginPath(this)} shows the login form: nobody is signed in.`, hint: 'Log in first (I am a logged in user with the "..." user).' });
  }
});

/**
 * Assert who is logged in, by a handle of the users registry: the page that
 * names the signed-in account (`worldParameters.accountPath`, /account on the
 * test app) shows its user name or its address.
 *
 * Example #1: Then I should be logged in as "user"
 * Example #2: Then we should be logged in as "admin"
 * Example #3: And I should be logged in as "developer"
 * Example #4: Then I should be logged in as "admin"
 * Example #5: And we should be logged in as "user"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  await open(this, siteUrl(this, accountPath(this)));
  if (isOnPath(this, loginPath(this)) || (await loginForm(this).isVisible().catch(() => false))) {
    throw friendly({ message: `Expected "${handle}" (${user.email}) to be logged in, but ${accountPath(this)} sent the browser to the login form: nobody is signed in.`, hint: 'Log in first (I am a logged in user with the "..." user).' });
  }
  const status = await documentStatus(this);
  if (status && status >= 400) {
    throw friendly({ message: `The account page ${accountPath(this)} answered HTTP ${status}.`, hint: 'Set worldParameters.accountPath in cucumber.js to a page of the app that names the signed-in account (its user name or its address).' });
  }
  const text = clean(await this.page.locator('body').innerText().catch(() => ''));
  const names = [user.email, user.username].filter(Boolean);
  // The page names the account by its address, else by its user name as a word of its own (a user
  // name such as "admin" is also a word of "Admin area").
  const shown = (text.match(/[^\s@()<>,;:"']+@[^\s@()<>,;:"']+\.[A-Za-z]{2,}/g) || []).map((m) => m.replace(/[.]+$/, ''));
  const named = shown.length
    ? shown.some((address) => address.toLowerCase() === user.email.toLowerCase())
    : !!user.username && new RegExp(`(?<![\\w.@-])${escapeRegExp(user.username)}(?![\\w@-])`).test(text);
  if (!named) {
    throw friendly({
      message: `Expected "${handle}" (${names.join(', ')}) to be logged in, but ${accountPath(this)} names ${shown.length ? listed(shown) : 'neither'}.`,
      hint: 'worldParameters.accountPath is the page that names the signed-in account, by its address or its user name.',
    });
  }
});

/**
 * Assert that the page shows, or does not show, the login form (an address or
 * user name field, a password field and a button), for instance after a page
 * that needs a session sent a visitor to it.
 *
 * Example #1: Then I should see the login form
 * Example #2: Then I should not see the login form
 * Example #3: And we should see the login form
 * Example #4: Then we should not see the login form
 * Example #5: But I should see the login form
 */
Then(/^(I |we )*should( not)* see the login form$/, async function (pronounCase, notCase) {
  await assertPresence(loginForm(this), notCase, {
    label: 'the login form',
    hint: LOGIN_HINT,
    timeout: budget(this),
    found: async () => `The page is ${this.page.url()} ("${clean(await this.page.title())}").`,
  });
  if (!notCase && !isOnPath(this, loginPath(this))) {
    throw friendly({ message: `A login form is on the page, but the page is ${currentPath(this)}, not ${loginPath(this)}.`, hint: 'Check worldParameters.loginPath in cucumber.js.' });
  }
});

/**
 * Let the session of the browser end, as an expired session does: the
 * browser drops the session cookie of the app and keeps its other cookies,
 * such as the one of a remembered login. Reload or open a page next, and
 * assert who is still signed in. The session cookie is the one named by
 * `worldParameters.sessionCookie`, else the cookie of the site whose name
 * says "session".
 *
 * Example #1: When my session expires
 * Example #2: When our session expires
 * Example #3: And my session expires
 * Example #4: Given my session expires
 * Example #5: When the session expires
 */
When(/^(my|our|the) session expires$/, async function (whoseCase) {
  const context = this.page.context();
  const host = new URL(siteUrl(this, '/')).hostname;
  const all = await context.cookies();
  const named = this.parameters && this.parameters.sessionCookie;
  const ofSite = all.filter((c) => host === c.domain.replace(/^\./, '') || host.endsWith(c.domain.replace(/^\./, '')));
  const session = ofSite.filter((c) => (named ? c.name === named : /sess/i.test(c.name)));
  if (!session.length) {
    throw friendly({
      message: `The browser has no session cookie of ${host} to drop. Its cookies there: ${listed(ofSite.map((c) => c.name))}.`,
      hint: 'Log in first. If the app names its session cookie another way, set worldParameters.sessionCookie in cucumber.js.',
    });
  }
  const kept = all.filter((c) => !session.includes(c));
  await context.clearCookies();
  if (kept.length) await context.addCookies(kept);
  forgetSession(this);
});

/**
 * Ask for a login link by mail, as a person does: the page of the login form
 * that sends one (`worldParameters.loginLinkPath`, /login/magic-link), the
 * address of an account (a handle of the users registry stands for its
 * address, anything else is used as it is), the "Send" button. Assert the
 * outcome with the next step: the page's message, the mail.
 *
 * Example #1: When I ask for a login link for "user"
 * Example #2: When we ask for a login link for "admin"
 * Example #3: When I ask for a login link for "nobody@example.com"
 * Example #4: And I ask for a login link for "developer"
 * Example #5: When we ask for a login link for "user@example.com"
 */
When(/^(I |we )*ask for a login link for "([^"]*)"$/, async function (pronounCase, who) {
  const address = addressOf(this, who);
  await open(this, siteUrl(this, loginLinkPath(this)));
  let field;
  try {
    field = await findField(this, 'email', { timeout: budget(this) });
  } catch (err) {
    throw friendly({ message: `The page that sends a login link did not show its form (${this.page.url()}).`, hint: 'It is at /login/magic-link (worldParameters.loginLinkPath), linked from the login form as "Use a Login Link": an "Email Address" field and a "Send" button.' });
  }
  await field.fill(address);
  const form = this.page.locator('form').filter({ has: field });
  const submit = form.locator('button[type="submit"], input[type="submit"]').first();
  this.__mailAskedAt = Date.now();
  await afterNavigation(this, () => submit.click());
});
