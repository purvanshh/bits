module.exports = {
  require: ['test/helpers/env.js', 'test/helpers/hooks.js'],
  spec: ['test/*.test.js'],
  timeout: 15000,
  exit: true,
};
