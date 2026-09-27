// Runs before test modules are imported (env() is read at module load).
process.env.E2E_UNIQ = process.env.E2E_UNIQ || Date.now().toString(36);
process.env.NODE_ENV = 'test';
process.env.JOBS_ENABLED = 'false';
process.env.SUPER_ADMIN_EMAIL = `admin.${process.env.E2E_UNIQ}@e2e.test`;
process.env.SUPER_ADMIN_PASSWORD = 'Admin@12345';
