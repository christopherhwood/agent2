const { createParser } = require('../../../../../../codeParser');

function detectChangedFunctionSignatures(originalCode, newCode) {
  const originalFunctionSignatures = detectFunctionSignatures(originalCode);
  const newFunctionSignatures = detectFunctionSignatures(newCode);
  const functionsWithChangedParams = [];
  const deletedFunctions = [];

  // We want to find the following:
  // Functions w/ same name but different params
  // Deleted functions
  for (const originalFunction of originalFunctionSignatures) {
    const newFunction = newFunctionSignatures.find(f => f.name === originalFunction.name);
    if (!newFunction) {
      deletedFunctions.push(originalFunction.name);
    } else if (originalFunction.params.join(',') !== newFunction.params.join(',')) {
      functionsWithChangedParams.push({name: originalFunction.name, oldParams: originalFunction.params, newParams: newFunction.params});
    }
  }
  return { functionsWithChangedParams, deletedFunctions };
}

function detectFunctionSignatures(code) {
  const parser = createParser();
  const tree = parser.parse(code);
  const functionSignatures = [];
  for (const node of tree.rootNode.descendantsOfType('function_declaration')) {
    functionSignatures.push({
      name: node.firstChild.text,
      params: node.descendantsOfType('parameter').map(p => p.firstChild.text)
    });
  }
  for (const node of tree.rootNode.descendantsOfType('arrow_function')) {
    functionSignatures.push({
      name: node.parent.firstChild.text,
      params: node.descendantsOfType('parameter').map(p => p.firstChild.text)
    });
  }
  return functionSignatures;
}

module.exports = { detectChangedFunctionSignatures };