<?= $this->extend(config('Auth')->views['layout']) ?>

<?= $this->section('title') ?><?= esc($title) ?><?= $this->endSection() ?>

<?= $this->section('main') ?>
    <div class="container d-flex justify-content-center p-5">
        <div class="card col-12 col-md-8 shadow-sm">
            <div class="card-body">
                <h1 class="h3 card-title mb-4"><?= esc($title) ?></h1>

                <?php if (session('message') !== null) : ?>
                    <div class="alert alert-success" role="alert"><?= esc(session('message')) ?></div>
                <?php endif ?>
                <?php if (session('error') !== null) : ?>
                    <div class="alert alert-danger" role="alert"><?= esc(session('error')) ?></div>
                <?php endif ?>

                <p>Signed in as <strong><?= esc($user->username) ?></strong> (<?= esc($user->email) ?>).</p>
                <p>Groups: <?= esc(implode(', ', $user->getGroups())) ?></p>

                <nav aria-label="Account">
                    <ul class="list-inline mb-0">
                        <li class="list-inline-item"><a href="<?= site_url('account') ?>">Your account</a></li>
                        <li class="list-inline-item"><a href="<?= site_url('admin') ?>">Admin area</a></li>
                        <li class="list-inline-item"><a href="<?= site_url('settings') ?>">Site settings</a></li>
                        <li class="list-inline-item"><a href="<?= url_to('logout') ?>">Log out</a></li>
                    </ul>
                </nav>
            </div>
        </div>
    </div>
<?= $this->endSection() ?>
