const { createParser, createQuery } = require('../../../../../codeParser');
const { extractFunctions } = require('../../../../summary/analysis/functionAnalysis');

function findIncorrectAsyncUsage(code) {
  const functions = extractFunctions(code);
  return checkAwaitUsage(functions, code);
}

// Function to check if a node is an async function
function checkAwaitUsage(functions, code) {
  const awaitQuery = `
  (await_expression) @await
  `;
  const parser = createParser();
  const tree = parser.parse(code);
  const queryObject = createQuery(awaitQuery);
  const matches = queryObject.matches(tree.rootNode);

  let errors = [];

  for (const match of matches) {
    const awaitNode = match.captures.find(capture => capture.name === 'await').node;
    const containingFunction = functions.find(func => awaitNode.startPosition.row + 1 >= func.line && awaitNode.endPosition.row + 1 <= func.endLine);

    containingFunction.containsAwait = true;
    if (containingFunction && !containingFunction.async) {
      errors.push({ message: `Function '${containingFunction.name}' must be async to use 'await'`, line: awaitNode.startPosition.row + 1, column: awaitNode.startPosition.column + 1, code: awaitNode.text });
    }
  }

  for (const func of functions) {
    if (func.async && !func.containsAwait) {
      errors.push({ message: `Function '${func.name}' is async but does not use 'await'`, line: func.line, column: func.column, code: func.code });
    }
  }
  return errors;
}

module.exports = { findIncorrectAsyncUsage };
