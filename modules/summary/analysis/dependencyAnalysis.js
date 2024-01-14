const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const path = require('path');
const parser = new Parser();
parser.setLanguage(JavaScript);

const { executeCommand } = require('../../../dockerOperations');

async function extractDependenciesFromFile(filePath) {
  const fileContents = await executeCommand(`cat ${filePath}`);
  const tree = parser.parse(fileContents);
  const queryObject = parser.getLanguage().query(query);
  const matches = queryObject.matches(tree.rootNode);

  let externalDependencies = [];
  let localDependencies = [];
  for (const match of matches) {
    for (const capture of match.captures) {
      if (capture.name === 'path') {
        const importPath = capture.node.text.replace(/^["']|["']$/g, '');
        const isLocal = determineIfDependencyIsLocal(importPath);
        if (isLocal) {
          // Resolve path to absolute path from root of repo
          let absolutePath = importPath;
          if (!importPath.startsWith('/')) {
            absolutePath = resolveAbsolutePath(filePath, importPath);
          }
          localDependencies.push(absolutePath);
        } else {
          externalDependencies.push(importPath);
        }
      }
    }
  }

  return { external: externalDependencies, local: localDependencies};
}

function determineIfDependencyIsLocal(importPath) {
  return importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/');
}

function resolveAbsolutePath(jsFilePath, relativeIncludePath) {
  // Get the directory of the JavaScript file
  const jsFileDir = path.dirname(jsFilePath);

  // Resolve the relative include path to an absolute path
  const absolutePath = path.resolve(jsFileDir, relativeIncludePath);

  return absolutePath;
}

const query = `
; Match ES6 import statements
(import_statement 
  (import_clause (identifier))
  source: (string) @path
)

; Match require calls
(call_expression 
  function: (identifier) @function
  arguments: (arguments (string)) @path
  (#eq? @function "require")
)
`;

module.exports = { extractDependenciesFromFile };