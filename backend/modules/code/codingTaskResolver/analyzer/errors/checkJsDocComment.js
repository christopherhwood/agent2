const { extractFunctionsFromTree } = require('../../../../summary/analysis/functionAnalysis');
const { createParser } = require('../../../../../codeParser');

function validateJsDocComments(code) {
  const parser = createParser();
  const tree = parser.parse(code);

  let errors = [];
  const functions = extractFunctionsFromTree(tree);
  functions.forEach(func => {
    const jsDocComment = extractJsDocComment(func.node);
    if (jsDocComment) {
      try {
        validateJsDoc(jsDocComment, func);
      } catch (err) {
        errors.push({ message: err.message, line: func.line, column: func.column, code: func.code });
      }
    } else {
      errors.push({ message: `JSDoc error. Missing JSDoc comment for function '${func.name}'.`, line: func.line, column: func.column, code: func.code });
    }
  });
  return errors;
}

function extractJsDocComment(funcNode) {
  let commentNode = funcNode.previousSibling;
  while (commentNode && commentNode.type !== 'comment') {
    commentNode = commentNode.previousSibling;
  }

  if (commentNode && commentNode.type === 'comment') {
    const commentText = commentNode.text;
    if (commentText.startsWith('/**')) {
      return commentText;
    }
  }

  return null;
}

function parseJsDoc(jsDocComment) {
  const lines = jsDocComment.split('\n');
  const jsDoc = { params: [], return: null };

  lines.forEach(line => {
    line = line.trim();

    if (line.startsWith('* @param')) {
      const paramMatch = line.match(/\* @param {(\w+)} (\w+)/);
      if (paramMatch) {
        jsDoc.params.push({ type: paramMatch[1], name: paramMatch[2] });
      }
    } else if (line.startsWith('* @return') || line.startsWith('* @returns')) {
      const returnMatch = line.match(/\* @return[s]? {([^}]+)}/);
      if (returnMatch) {
        jsDoc.return = { type: returnMatch[1] };
      }
    }
  });

  return jsDoc;
}

function validateJsDoc(jsDocComment, func) {
  const jsDoc = parseJsDoc(jsDocComment);

  // Validate parameters
  if (func.parameters.length !== jsDoc.params.length) {
    throw new Error(`JSDoc error. Parameter count mismatch. Expected ${func.parameters.length} but found ${jsDoc.params.length}.`);
  } else {
    for (let i = 0; i < func.parameters.length; i++) {
      if (func.parameters[i] !== jsDoc.params[i].name) {
        throw new Error(`JSDoc error. Parameter name mismatch. Expected ${func.parameters[i]} but found ${jsDoc.params[i].name}.`);
      }
    }
  }

  // Validate return type (basic check if @return is present)
  if (func.code.includes('return ')) {
    if (!jsDoc.return) {
      throw new Error('JSDoc error. Missing @return tag.');
    }
  }
}

module.exports = { validateJsDocComments };