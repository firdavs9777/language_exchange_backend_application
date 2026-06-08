const { ValidationError } = require('../utils/errors');

function check(source, schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first.path.join('.');
      return next(new ValidationError(path ? `${path}: ${first.message}` : first.message));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = {
  body:   (schema) => check('body', schema),
  query:  (schema) => check('query', schema),
  params: (schema) => check('params', schema),
};
