'use strict';

// Forms as a person reads them: a field filled with a value of an account of
// the users registry (so no feature writes a password), the messages a page
// shows after a form or a redirect (errors, successes, warnings, information),
// a field the browser refuses as empty, and a form whose security token is
// out of date.
//
// The text, the clicks and the plain filling of fields are webship-js's own
// steps (I fill in, I press, I click the "..." button, I should see): this file
// adds only what the app decides.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  eventually,
  resolveUser,
  findField,
  fillLikeABuiltIn,
  pageMessages,
} = require('./codeigniter-helpers');

const PARTS = { email: 'email', 'email address': 'email', username: 'username', 'user name': 'username', password: 'password' };

/** A part of an account of the registry: its address, its user name or its password. */
function accountPart(world, part, handle) {
  const user = resolveUser(world, handle);
  const key = PARTS[String(part).toLowerCase()];
  const value = user[key];
  if (!value) {
    throw friendly({
      message: `The user "${handle}" has no ${part} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.${key} in cucumber.js.`,
    });
  }
  return value;
}

/**
 * Fill in a field with the address, the user name or the password of an
 * account of the users registry, so a feature never writes a password and runs
 * against an app whose accounts have other names. The field is found as
 * webship-js's "I fill in" finds it: by its label, placeholder or name,
 * exactly as written.
 *
 * Example #1: When I fill in "Password" with the password of "user"
 * Example #2: When we fill in "Email Address" with the email of "user"
 * Example #3: And I fill in "Username" with the username of "admin"
 * Example #4: When I fill in "email" with the email address of "developer"
 * Example #5: And we fill in "Password (again)" with the password of "user"
 */
When(/^(I |we )*fill in "([^"]*)" with the (email|email address|username|user name|password) of "([^"]*)"$/, async function (pronounCase, field, part, handle) {
  await fillLikeABuiltIn(this, field, accountPart(this, part, handle));
});

/**
 * Assert that a field holds the address or the user name of an account of the
 * users registry: a form the app refused gives back what was typed in it.
 *
 * Example #1: Then the "Email Address" field should hold the email of "user"
 * Example #2: Then the "Username" field should hold the username of "user"
 * Example #3: And the "email" field should hold the email address of "admin"
 * Example #4: Then the "Email Address" field should hold the email of "developer"
 * Example #5: And the "username" field should hold the user name of "admin"
 */
Then(/^the "([^"]*)" field should hold the (email|email address|username|user name) of "([^"]*)"$/, async function (field, part, handle) {
  const wanted = accountPart(this, part, handle);
  const control = await findField(this, field);
  await eventually(this, () => control.inputValue().catch(() => ''), (value) => value === wanted, (value) => ({
    message: `Expected the "${field}" field to hold the ${part} of "${handle}" ("${wanted}"), but it holds "${value}".`,
    hint: 'A form the app refused comes back with what was typed in it, the passwords left out.',
  }));
});

/** The messages of a kind on the page, as lines. */
async function messagesOf(world, kind) {
  return (await pageMessages(world)).filter((m) => m.kind === kind).map((m) => m.text);
}

/** A line of a message box says the text: it is the text, or holds it. */
function says(lines, text) {
  const wanted = clean(text);
  return lines.some((line) => line === wanted || line.includes(wanted));
}

/**
 * Assert a message the page shows, by its kind: an error ("Unable to log you
 * in. Please check your password."), a success ("You have successfully logged
 * out."), a warning or an information. The message is a line of a message box
 * of the page (`role="alert"` or `role="status"`, marked by its kind: an
 * `alert-danger` box is an error, `alert-success` a success); a box that
 * lists several errors (a refused form) holds one per line. The step waits
 * for the message, so it holds right after the press that sent the form.
 *
 * Example #1: Then I should see the error message "Unable to log you in. Please check your password."
 * Example #2: Then I should see the success message "You have successfully logged out."
 * Example #3: And I should see the error message "The Email Address field must contain a unique value."
 * Example #4: Then we should not see the error message "Unable to log you in. Please check your credentials."
 * Example #5: Then I should see the warning message "Your session will end in five minutes."
 */
Then(/^(I |we )*should( not)* see the (error|success|warning|info) message "([^"]*)"$/, async function (pronounCase, notCase, kind, text) {
  if (notCase) {
    const lines = await messagesOf(this, kind);
    if (says(lines, text)) {
      throw friendly({ message: `Expected not to see the ${kind} message "${text}", but the page shows it (${this.page.url()}).`, hint: 'The page shows a message after a form it refused or an action it did.' });
    }
    return;
  }
  try {
    await eventually(this, () => messagesOf(this, kind), (lines) => says(lines, text), () => ({ message: 'no match' }), budget(this));
  } catch {
    const all = await pageMessages(this);
    const same = all.filter((m) => m.kind === kind).map((m) => m.text);
    const others = all.filter((m) => m.kind !== kind).map((m) => `${m.kind}: "${m.text}"`);
    throw friendly({
      message: `Expected the ${kind} message "${text}" (${this.page.url()}). ${same.length ? `The ${kind} messages: ${listed(same)}.` : `The page shows no ${kind} message.`}${others.length ? ` Other messages: ${others.join(', ')}.` : ''}`,
      hint: `A message is a line of a message box of the page (role="alert" or role="status"); its kind comes from the box (an "alert-danger" box holds errors, "alert-success" successes).`,
    });
  }
});

/**
 * Assert that the page shows no message of a kind at all: no error after a
 * form the app took, no success after one it refused.
 *
 * Example #1: Then I should not see any error message
 * Example #2: And we should not see any success message
 * Example #3: Then I should not see any error messages
 * Example #4: But I should not see any warning message
 * Example #5: Then we should not see any info message
 */
Then(/^(I |we )*should not see any (error|success|warning|info) messages?$/, async function (pronounCase, kind) {
  const lines = await messagesOf(this, kind);
  if (lines.length) {
    throw friendly({ message: `Expected no ${kind} message, but the page shows: ${listed(lines)} (${this.page.url()}).`, hint: 'The page shows a message after a form it refused or an action it did.' });
  }
});

/**
 * Assert that the browser refused to send a form because a required field is
 * empty, naming the field: the form stays on screen and no request is made.
 * The field is the one a person reads by that label (or its name).
 *
 * Example #1: Then the "Username" field should block submission as required
 * Example #2: And the "Email Address" field should block submission as required
 * Example #3: Then the "Password" field should block submission as required
 * Example #4: And the "Password (again)" field should block submission as required
 * Example #5: Then the "email" field should block submission as required
 */
Then(/^the "([^"]*)" field should block submission as required$/, async function (label) {
  const invalid = await this.page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const labelOf = (el) => {
      const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean);
      if (by.length) return norm(by.map((n) => n.textContent).join(' '));
      if (el.labels && el.labels[0]) return norm(el.labels[0].textContent);
      return norm(el.getAttribute('aria-label') || el.name || '');
    };
    const found = [];
    for (const form of document.forms) {
      if (form.noValidate) continue;
      for (const el of form.elements) {
        if (!el.willValidate || el.checkValidity()) continue;
        found.push({ label: labelOf(el), name: el.name || '', missing: el.validity.valueMissing, message: el.validationMessage });
      }
    }
    return found;
  });
  if (!invalid.length) {
    throw friendly({
      message: 'Expected the form to be blocked by an empty required field, but every field of the forms on the page passes the browser\'s checks.',
      hint: 'A form with the "novalidate" attribute is checked by the server instead: assert its error message with the "I should see the error message ..." step.',
    });
  }
  const wanted = label.trim().toLowerCase();
  const hit = invalid.find((field) => field.label.toLowerCase() === wanted || field.name.toLowerCase() === wanted)
    || invalid.find((field) => field.label.toLowerCase().startsWith(wanted));
  if (!hit || !hit.missing) {
    throw friendly({
      message: `Expected the "${label}" field to block the form as empty. The fields the browser refuses: ${invalid.map((field) => `"${field.label || field.name}" (${field.message})`).join(', ')}.`,
      hint: 'Leave the field empty and press the button that sends the form; the browser checks the required fields before it sends anything.',
    });
  }
});

/**
 * Make the security token of the forms on the page out of date, as a form
 * left open in a tab while the session behind it was renewed: the hidden
 * field that carries the token (named like "csrf" or "token") gets a value the
 * app never issued. Send the form next, and assert the refusal.
 *
 * Example #1: When the security token of the form expires
 * Example #2: And the security token of the form expires
 * Example #3: Given the security token of the form expires
 * Example #4: When the security tokens of the forms expire
 * Example #5: And the security tokens of the forms expire
 */
When(/^the security tokens? of the forms? (?:expires|expire)$/, async function () {
  const changed = await this.page.evaluate(() => {
    const names = [];
    for (const input of document.querySelectorAll('form input[type="hidden"]')) {
      if (!/csrf|xsrf|token/i.test(input.name || '')) continue;
      input.value = 'an-out-of-date-token-' + Date.now();
      names.push(input.name);
    }
    return names;
  });
  if (!changed.length) {
    throw friendly({
      message: `No form of the page carries a security token (${this.page.url()}): no hidden field named like "csrf" or "token".`,
      hint: 'Open a page with a form first (the login form, the registration form). A form without a token is not protected from forged requests.',
    });
  }
});
