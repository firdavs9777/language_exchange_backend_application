// Wrap an async route handler so thrown rejections forward to Express's
// error pipeline. Without this we'd need try/catch in every controller.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
