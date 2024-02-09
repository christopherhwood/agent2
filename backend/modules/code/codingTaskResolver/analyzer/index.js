const { validateJsDocComments } = require('./errors/checkJSDocComment');

function analyzeNewCode(newCode) {
  const errors = [];
  
  const commentErrors = validateJsDocComments(newCode);

  errors.push(...commentErrors);

  return { errors };
}

module.exports = { analyzeNewCode };