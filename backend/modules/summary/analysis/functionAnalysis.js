const { createParser, createQuery } = require('../../../codeParser');

function extractFunctions(code) {
  const parser = createParser();
  const tree = parser.parse(code);
  const functions = extractFunctionsFromTree(tree);

  // Node is only useful if the tree is still alive.
  functions.map(func => {
    delete func.node;
  });
  return functions;
}

function extractFunctionsFromTree(tree) {
  const queryObject = createQuery(query);
  const matches = queryObject.matches(tree.rootNode);

  let functions = []; 
  for (const match of matches) {
    let func = {name: '', async: false, parameters: []};
    for (const capture of match.captures) {
      if (capture.name === 'function-name') {
        func.name = capture.node.text;
        func.code = capture.node.parent.text;
        func.async = capture.node.parent.children[0].text === 'async';
        func.line = capture.node.parent.startPosition.row + 1;
        func.column = capture.node.parent.startPosition.column + 1;
        func.endLine = capture.node.parent.endPosition.row + 1;
        func.node = capture.node.parent;
      } else if (capture.name === 'parameters') {
        const identifierQuery = `
(identifier) @identifier
`;
        const identifierQueryObject = createQuery(identifierQuery);
        capture.node.children.forEach(child => {
          const identifierMatches = identifierQueryObject.matches(child);
          for (const identifierMatch of identifierMatches) {
            for (const identifierCapture of identifierMatch.captures) {
              func.parameters.push(identifierCapture.node.text);
            }
          }
        });
      }
    }
    functions.push(func);
  }

  return functions;
}

const query = `
; Match function declarations
(function_declaration 
  name: (identifier) @function-name
  parameters: (formal_parameters) @parameters
)

; Match function expressions
(function 
  name: (identifier) @function-name
  parameters: (formal_parameters) @parameters
)

; Match variable declarations with arrow function
(lexical_declaration 
  (variable_declarator 
    name: (identifier) @function-name
    value: (arrow_function 
      parameters: (formal_parameters) @parameters
    )
  )
)

; Match assignment expressions with arrow function
(assignment_expression 
  left: (identifier) @function-name
  right: (arrow_function 
    parameters: (formal_parameters) @parameters
  )
)
`;

module.exports = { extractFunctions, extractFunctionsFromTree };