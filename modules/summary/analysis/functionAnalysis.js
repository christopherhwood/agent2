const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const parser = new Parser();
parser.setLanguage(JavaScript);

async function extractFunctionDeclarationsFromFile(fileName, executeCommand) {
  const fileContents = await executeCommand(`cat ${fileName}`);
  const tree = parser.parse(fileContents);
  const queryObject = new Parser.Query(JavaScript, query);
  const matches = queryObject.matches(tree.rootNode);

  let functions = []; 
  for (const match of matches) {
    let func = {name: '', parameters: []};
    for (const capture of match.captures) {
      if (capture.name === 'function-name') {
        func.name = capture.node.text;
      } else if (capture.name === 'parameters') {
        const identifierQuery = `
(identifier) @identifier
`;
        const identifierQueryObject = new Parser.Query(JavaScript, identifierQuery);
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

module.exports = { extractFunctionDeclarationsFromFile };