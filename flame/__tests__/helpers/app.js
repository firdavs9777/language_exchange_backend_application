const express = require('express');

// Builds a minimal Express app that mounts the Flame router. Used by
// integration tests so we don't depend on server.js or BananaTalk routes.
function buildApp() {
  // require AFTER env + DB are set up by the test
  delete require.cache[require.resolve('../../index')];
  const flameRouter = require('../../index');
  const app = express();
  app.use('/flamebackend/v1', flameRouter);
  return app;
}

module.exports = { buildApp };
