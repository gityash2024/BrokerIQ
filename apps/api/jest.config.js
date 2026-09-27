/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testRegex: '(test/.*\\.e2e-spec\\.ts|src/.*\\.spec\\.ts)$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true }] },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
