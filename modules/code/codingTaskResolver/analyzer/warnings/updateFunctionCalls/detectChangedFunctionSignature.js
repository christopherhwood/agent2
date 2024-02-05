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
    const returnTypeAnalysis = analyzeReturnTypes(node);
    functionSignatures.push({
      name: nameNode.text,
      params: node.descendantsOfType('identifier').filter(i => i.parent.type === 'formal_parameters').map(p => p.text),
      returnType: returnTypeAnalysis
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

function analyzeReturnTypes(node) {
  const returnStatements = node.descendantsOfType('return_statement');
  if (returnStatements.length === 0) return 'void';

  // Simplified analysis for demonstration purposes
  const returnTypes = returnStatements.map(r => {
    const returnValue = r.descendantsOfType('literal').map(l => l.text);
    if (returnValue.length > 0) {
      return typeof returnValue[0]; // Primitive type based on the literal
    }
    // Check for object or array returns
    if (r.text.includes('{') || r.text.includes('[')) {
      return 'object';
    }
    // Default to 'unknown' if unable to determine
    return 'unknown';
  });

  // For simplicity, return the first identified type
  return returnTypes[0];
}

module.exports = { detectChangedFunctionSignatures };