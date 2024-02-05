const { createParser } = require('../../../../../../codeParser');

function detectChangedFunctionSignatures(originalCode, newCode) {
  const originalFunctionSignatures = detectFunctionSignatures(originalCode);
  const newFunctionSignatures = detectFunctionSignatures(newCode);
  const functionsWithChangedParams = [];
  const deletedFunctions = [];

  console.log('originalFunctionSignatures:', JSON.stringify(originalFunctionSignatures));
  console.log('newFunctionSignatures:', JSON.stringify(newFunctionSignatures));

  // We want to find the following:
  // Functions w/ same name but different params
  // Deleted functions
  for (const originalFunction of originalFunctionSignatures) {
    const newFunction = newFunctionSignatures.find(f => f.name === originalFunction.name);
    if (!newFunction) {
      deletedFunctions.push({name: originalFunction.name, oldParams: originalFunction.params});
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
    const nameNode = node.descendantsOfType('identifier').find(i => i.parent === node);
    if (!nameNode) {
      console.log('Error: no name for function declaration. \n', node.text);
      continue;
    }
    const returnTypeNode = node.descendantsOfType('return_statement').map(r => r.text);
    functionSignatures.push({
      name: nameNode.text,
      params: node.descendantsOfType('identifier').filter(i => i.parent.type === 'formal_parameters').map(p => p.text),
      returnType: returnTypeNode.length > 0 ? returnTypeNode[0] : 'void'
    });
  }
  for (const node of tree.rootNode.descendantsOfType('arrow_function')) {
    const nameNode = node.parent.descendantsOfType('identifier').find(i => i.parent === node.parent);
    if (!nameNode) {
      console.log('No name for arrow function. \n', node.text);
      continue;
    }
    const returnTypeNode = node.descendantsOfType('return_statement').map(r => r.text);
    functionSignatures.push({
      name: nameNode.text,
      params: node.descendantsOfType('identifier').filter(i => i.parent.type === 'formal_parameters').map(p => p.text),
      returnType: returnTypeNode.length > 0 ? returnTypeNode[0] : 'void'
    });
  }
  return functionSignatures;
}

module.exports = { detectChangedFunctionSignatures };