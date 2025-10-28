export default {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'pages/static/pages/js/**/*.js',
    '!pages/static/pages/js/**/*.config.js',
    '!pages/static/pages/js/**/main.js'
  ],
  transform: {},
  extensionsToTreatAsEsm: ['.js']
};