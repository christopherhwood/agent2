const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const parser = new Parser();
parser.setLanguage(JavaScript);

const { executeCommand } = require('../../../dockerOperations');

async function extractFunctionDeclarationsFromFile(fileName) {
  const fileContents = await executeCommand(`cat ${fileName}`);
  const tree = parser.parse(fileContents);
  const queryObject = parser.getLanguage().query(query);
  const matches = queryObject.matches(tree.rootNode);

  let functions = []; 
  for (const match of matches) {
    for (const capture of match.captures) {
      let func = {name: '', parameters: []};
      if (capture.name === 'function-name') {
        func.name = capture.node.text;
      } else if (capture.name === 'parameters') {
        capture.node.namedChildren.forEach(child => {
          if (child.type === 'identifier') {
            func.parameters.push(child.text);
          }
        });
      }
      functions.push(func);
    }
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

module.exports = { extractFunctionDeclarationsFromFile };