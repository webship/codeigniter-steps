// A feature file, a scenario (file:line), a folder or a rerun file named on
// the command line of cucumber-js runs alone: `npx cucumber-js
// tests/features/session.feature`. cucumber-js 12 adds the paths of the
// command line to the `paths` of this file instead of using them alone, so
// `paths` is left empty when the command line names any, as in webship-js.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  // Only when cucumber-js itself runs, not when another script reads this file.
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

// The default is the local DDEV app that .github/scripts/build-ddev-site.sh
// builds (project "codeignitersteps"), never an app of somebody else: the
// suite logs in with the accounts below. LAUNCH_URL points it at another app.
const launchUrl = process.env.LAUNCH_URL || 'https://codeignitersteps.ddev.site';

module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      'tests/step-definitions/**/*.js',                                  // The step definitions of this pack.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset too.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : (commandLinePaths().length ? [] : ['tests/features/**/*.feature']),
    // CUCUMBER_TAGS=@critical runs a lane. The default leaves out work in progress, the assertions that
    // must fail (tests/check-must-fail.js runs them), and the lane that needs the app in the development
    // environment (@development: the debug toolbar and the debug page).
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail and not @development',
    format: [
      '@cucumber/pretty-formatter',
      // REPORT_NAME=must-fail keeps the report of another run (tests/check-must-fail.js) apart.
      `json:tests/reports/${process.env.REPORT_NAME || 'cucumber_report'}.json`,
    ],
    formatOptions: {
      // Colours follow the terminal (GitHub Actions counts as one); FORCE_COLOR=1
      // or FORCE_COLOR=0 sets them. cucumber-js 12 deprecated `colorsEnabled`.
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl,
      // The pages of the app the steps open by themselves: the login page, the address that ends a
      // session, the page that mails a login link, and a page that names the signed-in account (the
      // test app adds /account; set it to a page of your app that shows the account's name or address).
      loginPath: process.env.LOGIN_PATH || '/login',
      logoutPath: process.env.LOGOUT_PATH || '/logout',
      loginLinkPath: process.env.LOGIN_LINK_PATH || '/login/magic-link',
      accountPath: process.env.ACCOUNT_PATH || '/account',
      // The mailbox that catches the mail of the app (the login link steps read it): the Mailpit of the
      // DDEV project.
      mailUrl: process.env.MAIL_URL || launchUrl.replace(/\/+$/, '') + ':8026',
      // An account that logged in once keeps its session for the rest of the run: later scenarios take it
      // over instead of filling in the login form again.
      reuseSessions: process.env.REUSE_SESSIONS !== 'false',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them;
      // @js-fail, @js-warn and @js-off per scenario. The error pages carry @js-off: the browser logs
      // "Failed to load resource: the server responded with a status of 4xx/5xx" for each of them.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },
      // The accounts that "I am a logged in user with the ... user" uses, by handle. They are configuration,
      // not test data: the build of the app creates them once (.github/scripts/build-ddev-site.sh) and a
      // feature never creates or deletes users. Point the suite at another app with the *_EMAIL,
      // *_USERNAME and *_PASSWORD variables.
      users: {
        // The "admin" group: the admin area.
        admin: {
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'Account-Pass-2026!',
        },
        // The "developer" group: the site settings (the "admin.settings" permission), not the admin area.
        developer: {
          email: process.env.DEVELOPER_EMAIL || 'developer@example.com',
          username: process.env.DEVELOPER_USERNAME || 'developer',
          password: process.env.DEVELOPER_PASSWORD || 'Account-Pass-2026!',
        },
        // The "user" group, the one a new account gets: neither.
        user: {
          email: process.env.USER_EMAIL || 'user@example.com',
          username: process.env.USER_USERNAME || 'user',
          password: process.env.USER_PASSWORD || 'Account-Pass-2026!',
        },
        // An account of the "user" group that is banned: the app refuses its login.
        banned: {
          email: process.env.BANNED_EMAIL || 'banned@example.com',
          username: process.env.BANNED_USERNAME || 'banned',
          password: process.env.BANNED_PASSWORD || 'Account-Pass-2026!',
        },
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
    },
  },
};
