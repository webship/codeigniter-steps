
// Added by the test app of the webship-js suite: the pages an app guards with
// the filters of the auth library, and an error nothing catches.
$routes->get('account', 'TestFixtures::account', ['filter' => 'session']);
$routes->get('admin', 'TestFixtures::admin', ['filter' => 'group:admin,superadmin']);
$routes->get('settings', 'TestFixtures::settings', ['filter' => 'permission:admin.settings']);
$routes->get('test-fixtures/server-error', 'TestFixtures::serverError');
