const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function start() {
  mongod = await MongoMemoryServer.create();
  process.env.FLAME_MONGO_URI = mongod.getUri();
  return process.env.FLAME_MONGO_URI;
}

async function stop() {
  if (mongod) await mongod.stop();
}

module.exports = { start, stop };
