'use strict';

// The pages the framework itself answers with: the welcome page of a new app
// and the environment it says it runs in, the error pages by their status,
// the check that a live app shows no debug information, and a form a page of
// another site sends to the app.
//
// The status a step reads is the one the browser received for the page on
// screen (webship-js records it for every navigation), so it follows the
// session and the forms the scenario sent; webship-js's own "the response
// status code should be ..." reads the same.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  siteUrl,
  currentPath,
  settle,
  resolveUser,
  pageSummary,
} = require('./codeigniter-helpers');

// The words an error page of the framework prints with its code, in its
// production views (the title, or the text).
const STATUS_WORDS = {
  400: /bad request/i,
  403: /forbidden|not allowed/i,
  404: /not found|cannot seem to find/i,
  500: /whoops|snag|server error/i,
};

/**
 * Assert that the browser shows the error page of a status: the page answered
 * with that status, and it says so: the code in its title or main heading
 * ("404 - Page Not Found"), or the words the framework's own error page uses
 * for it ("Whoops!" for 500). An app with error pages of its own passes as
 * long as they print the code.
 *
 * Example #1: Then I should see the 404 error page
 * Example #2: Then I should see the 500 error page
 * Example #3: And I should see the 403 error page
 * Example #4: Then we should see the 404 error page
 * Example #5: Then I should not see the 404 error page
 */
Then(/^(I |we )*should( not)* see the (\d{3}) error page$/, async function (pronounCase, notCase, code) {
  const wanted = Number(code);
  const words = STATUS_WORDS[wanted];
  const shows = (s) => s.status === wanted && (s.title.includes(code) || s.heading.includes(code) || (!!words && (words.test(s.title) || words.test(s.heading))));
  const summary = await pageSummary(this);
  if (notCase ? !shows(summary) : shows(summary)) return;
  const what = `HTTP ${summary.status === null ? '(status unknown)' : summary.status}, "${summary.title}"${summary.heading ? `, heading "${summary.heading}"` : ''}`;
  if (notCase) {
    throw friendly({ message: `Expected not to see the ${code} error page, but the browser shows it (${what}) at ${currentPath(this)}.`, hint: 'The step reads the status the browser received for the page on screen.' });
  }
  throw friendly({
    message: `Expected the ${code} error page, but the browser shows ${what} at ${currentPath(this)}: "${summary.text.slice(0, 160)}".`,
    hint: summary.status === wanted
      ? `The status is right, but the page does not say ${code} in its title or main heading: an app with its own error pages should.`
      : 'The step reads the status the browser received for the page on screen (the one the last navigation, link or form brought).',
  });
});

/** The signs of a debug page the page shows: what a live app must never print. */
async function debugSigns(world) {
  return world.page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    const headings = [...document.querySelectorAll('h1, h2')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
    const signs = [];
    const exception = [document.title, ...headings].find((h) => /(?:^|\\)[A-Z][A-Za-z]*(?:Exception|Error)\b/.test(h) && !/^\d{3}\b/.test(h));
    if (exception) signs.push(`the exception class "${exception}"`);
    if (document.querySelector('#backtrace, .trace, ol.trace')) signs.push('a backtrace');
    if (/\b(?:Exception|Stack) trace\b/i.test(text)) signs.push('an exception trace');
    const file = text.match(/[\w./-]+\.php(?::| at line )\d+/);
    if (file) signs.push(`a source file "${file[0]}"`);
    const runtime = text.match(/\bPHP:? \d+\.\d+(?:\.\d+)?\b/);
    if (runtime) signs.push(`the runtime version "${runtime[0]}"`);
    if (/\b[A-Z][A-Za-z]+\\[A-Z][A-Za-z]+\\[A-Z]/.test(text)) signs.push('class names of the app');
    if (/Can't find a route for/i.test(text)) signs.push('the routing detail of a missing page');
    return signs;
  }).catch(() => []);
}

/**
 * Assert that the page shows no debug information: no exception class, no
 * backtrace, no source file and line, no runtime version, no class names. A
 * live app answers an error with a plain error page; a debug page shows how
 * the app is built to anybody. "should show" asserts the other side: the
 * debug page of an app that runs in development.
 *
 * Example #1: Then the page should not show debug information
 * Example #2: And the page should not show debug information
 * Example #3: Then the page should show debug information
 * Example #4: But the page should not show debug information
 * Example #5: And the page should show debug information
 */
Then(/^the page should( not)* show debug information$/, async function (notCase) {
  const signs = await debugSigns(this);
  if (notCase && signs.length) {
    throw friendly({
      message: `The page shows debug information: ${signs.join(', ')} (${currentPath(this)}).`,
      hint: 'A live app runs in the production environment (CI_ENVIRONMENT = production in its .env): an error then renders the plain error page.',
    });
  }
  if (!notCase && !signs.length) {
    const summary = await pageSummary(this);
    throw friendly({
      message: `Expected the page to show debug information, but it shows none (HTTP ${summary.status}, "${summary.title}").`,
      hint: 'Only an app that runs in the development environment shows its debug page for an error.',
    });
  }
});

/**
 * Send the login form of an account to an address of the app from a page of
 * another site, as a forged form on somebody else's page does: the browser
 * posts the address and the password of the account (a handle of the users
 * registry), with no valid security token, and says it comes from another
 * site. An app that protects its forms refuses it; assert that with the next
 * step ("I should not be logged in").
 *
 * Example #1: When a page of another site sends the login form of "user" to "/login"
 * Example #2: When a page of another site sends the login form of "admin" to "/login"
 * Example #3: And a page of another site sends the login form of "developer" to "/login"
 * Example #4: When a page of another site sends the login form of "user" to "/register"
 * Example #5: When a page of another site sends the login form of "admin" to "/login/magic-link"
 */
When(/^a page of another site sends the login form of "([^"]*)" to "([^"]*)"$/, async function (handle, path) {
  const user = resolveUser(this, handle);
  const action = siteUrl(this, path);
  const page = this.page;
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><title>Another site</title><form method="post" action="${esc(action)}">`
    + '<input type="hidden" name="csrf_test_name" value="a-token-of-another-site"><input type="hidden" name="_token" value="a-token-of-another-site">'
    + `<input type="hidden" name="email" value="${esc(user.email)}"><input type="hidden" name="username" value="${esc(user.username || '')}">`
    + `<input type="hidden" name="password" value="${esc(user.password)}"><button type="submit">Send</button></form>`);
  try {
    await Promise.all([
      page.waitForNavigation({ timeout: budget(this) }),
      page.locator('button[type="submit"]').click(),
    ]);
  } catch (err) {
    throw friendly({ message: `The form of the other site did not reach ${action}.`, cause: err, hint: 'Check launchUrl in cucumber.js.' });
  }
  await page.waitForLoadState('load', { timeout: budget(this) }).catch(() => {});
  await settle(this);
});

/**
 * Assert that the browser shows, or does not show, the welcome page of a new
 * app: its main heading starts with "Welcome to", it has the "About this page"
 * section, and its footer says how long the page took and in which
 * environment it runs. A real app replaces it; a new app shows it at its home
 * address.
 *
 * Example #1: Then I should see the welcome page
 * Example #2: Then I should not see the welcome page
 * Example #3: And we should see the welcome page
 * Example #4: Then we should not see the welcome page
 * Example #5: But I should see the welcome page
 */
Then(/^(I |we )*should( not)* see the welcome page$/, async function (pronounCase, notCase) {
  const read = () => this.page.evaluate(() => {
    const heading = document.querySelector('header h1, h1');
    const footer = document.querySelector('footer');
    return {
      heading: heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '',
      about: [...document.querySelectorAll('h1, h2')].some((h) => /^\s*About this page\s*$/i.test(h.textContent)),
      footer: footer ? footer.innerText.replace(/\s+/g, ' ').trim() : '',
    };
  }).catch(() => ({ heading: '', about: false, footer: '' }));
  const seen = await read();
  const welcome = /^Welcome to\b/i.test(seen.heading) && seen.about && /Page rendered in .* seconds/i.test(seen.footer) && /Environment:/i.test(seen.footer);
  if (notCase && welcome) {
    throw friendly({ message: `Expected not to see the welcome page, but ${currentPath(this)} shows it ("${seen.heading}").`, hint: 'A new app shows the welcome page at its home address until the app replaces it.' });
  }
  if (!notCase && !welcome) {
    const missing = [];
    if (!/^Welcome to\b/i.test(seen.heading)) missing.push(`a main heading that starts with "Welcome to" (it is "${seen.heading}")`);
    if (!seen.about) missing.push('the "About this page" section');
    if (!/Page rendered in .* seconds/i.test(seen.footer) || !/Environment:/i.test(seen.footer)) missing.push('the footer that says how long the page took and the environment');
    throw friendly({ message: `Expected the welcome page at ${currentPath(this)}, but it has no ${missing.join(', no ')}.`, hint: 'The welcome page is the home page of a new app made from the app starter: open "/".' });
  }
});

/**
 * Assert the environment the page says the app runs in: the "Environment:"
 * line of the welcome page's footer, or of the banner of the debug page.
 * "production" is how a live app runs; "development" shows the debug toolbar
 * and the debug page.
 *
 * Example #1: Then the page should say it runs in the "production" environment
 * Example #2: Then the page should say it runs in the "development" environment
 * Example #3: And the page should say it runs in the "production" environment
 * Example #4: Then the page should say it runs in the "testing" environment
 * Example #5: But the page should say it runs in the "production" environment
 */
Then(/^the page should say it runs in the "([^"]*)" environment$/, async function (environment) {
  const text = clean(await this.page.locator('body').innerText({ timeout: budget(this) }).catch(() => ''));
  const said = (text.match(/Environment:\s*([A-Za-z]+)/) || [])[1];
  if (!said) {
    throw friendly({ message: `The page does not say which environment the app runs in (${currentPath(this)}): it has no "Environment:" line.`, hint: 'The welcome page says it in its footer, and the debug page in its banner. Open "/" first.' });
  }
  if (said.toLowerCase() !== environment.toLowerCase()) {
    throw friendly({ message: `Expected the page to say it runs in the "${environment}" environment, but it says "${said}".`, hint: 'The environment is CI_ENVIRONMENT in the .env of the app (php spark env <environment> sets it).' });
  }
});
