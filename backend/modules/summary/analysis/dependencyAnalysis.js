const path = require('path');
const { createParser, createQuery } = require('../../../codeParser');
const { executeCommand } = require('../../../dockerOperations');

async function extractDependencies(code, basePath, repoName) {
  const parser = createParser();
  const tree = parser.parse(code);
  const queryObject = createQuery(query);
  const matches = queryObject.matches(tree.rootNode);

  let externalDependencies = [];
  let localDependencies = [];
  for (const match of matches) {
    let fileExports = {
      default: null,
      named: [],
      namespace: null
    };
    for (const capture of match.captures) {  
      if (capture.name === 'defaultExport') {
        fileExports.default = gatherDependencyContext(capture, code);
      } else if (capture.name === 'export') {
        // TODO: Handle aliasing
        fileExports.named.push(gatherDependencyContext(capture, code));
      } else if (capture.name === 'namespace') {
        fileExports.namespace = gatherDependencyContext(capture, code);
      } else if (capture.name === 'path') {
        // Remove starting and ending parentheses
        let importPath = capture.node.text.replace(/^\(|\)$/g, '');
        // Remove starting and ending quotes
        importPath = importPath.replace(/^["']|["']$/g, '');
        const isLocal = determineIfDependencyIsLocal(importPath);
        if (isLocal) {
          // Resolve path to absolute path from root of repo
          let absolutePath = importPath;
          if (!importPath.startsWith('/')) {
            absolutePath = resolveAbsolutePath(basePath, importPath);
          }
          const importGrepPatterns = await getAllPotentialDependencyImportPathGrepPatterns(absolutePath, repoName);
          // Try to get the dependency if it already exists
          const existingDependency = localDependencies.find(dep => dep.pathRelativeToRoot === absolutePath);
          if (existingDependency) {
            existingDependency.exports.named.push(...fileExports.named);
          } else {
            localDependencies.push({
              pathRelativeToRoot: absolutePath, 
              line: capture.node.startPosition.row + 1, 
              column: capture.node.startPosition.column + 1, 
              code: capture.node.text,
              importGrepPatterns,
              exports: fileExports
            });
          }
        } else {
          // Try to get the dependency if it already exists
          const existingDependency = externalDependencies.find(dep => dep.pathRelativeToRoot === importPath);
          if (existingDependency) {
            existingDependency.exports.named.push(...fileExports.named);
          } else {
            externalDependencies.push({
              pathRelativeToRoot: importPath, 
              line: capture.node.startPosition.row + 1, 
              column: capture.node.startPosition.column + 1, 
              code: capture.node.text,
              importGrepPatterns: [importPath],
              exports: fileExports
            });
          }
        }
      }
    }
  }
  console.log('localDependencies', localDependencies);
  return { external: externalDependencies, local: localDependencies};
}

function gatherDependencyContext(capture, code) {
  const context = {
    alias: capture.node.text,
    isClass: false,
    isFunction: false,
    objectProperties: [],
  };
  // Search code for new + defaultExport.alias
  const isClass = code.includes(`new ${capture.node.text}`);
  context.isClass = isClass;

  // Search code for '${defaultExport.alias}('
  const isFunction = code.includes(`${capture.node.text}(`);
  context.isFunction = isFunction;

  // Search code for '${defaultExport.alias}.'
  let search = `${capture.node.text}.`;
  let index = code.indexOf(search);
  while (index !== -1) {
    const objectProperty = code.substring(index + search.length, code.indexOf(' ', index + search.length));
    context.objectProperties.push(objectProperty);
    index = code.indexOf(search, index + search.length);
  }
  return context;
}

function determineIfDependencyIsLocal(importPath) {
  return importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/');
}

function resolveAbsolutePath(jsFilePath, relativeIncludePath) {
  // Get the directory of the JavaScript file
  const jsFileDir = path.dirname(jsFilePath);

  // Resolve the relative include path based on the JavaScript file directory
  const resolvedPath = path.resolve(jsFileDir, relativeIncludePath);

  // Convert the resolved path to a relative path from the repository root
  const relativePathFromRoot = path.relative('.', resolvedPath);

  return relativePathFromRoot;
}

// NOTE - there is probably a bug in here where the pathRelativeToRoot is just index.js, but that doesn't seem worth solving right now.
async function getAllPotentialDependencyImportPathGrepPatterns(pathRelativeToRoot, repoName) {
  let jsPath = pathRelativeToRoot;
  if (!jsPath.endsWith('.js')) {
    jsPath += '.js';
  }
  const contents = await executeCommand(`cat ${jsPath}`, repoName);
  if (contents.length > 25 || (!contents.includes('No such file or directory') && !contents.includes('Is a directory'))) {
    const jsPathComponents = jsPath.split('/');
    if (jsPathComponents[jsPathComponents.length - 1] === 'index.js' && jsPathComponents.length > 1) {
      // i.e. modules/code/codingTaskResolver/index.js
      // we return codingTaskResolver, codingTaskResolver/index, and codingTaskResolver/index.js
      const longPath = jsPathComponents.slice(jsPathComponents.length - 2).join('/');
      return [jsPathComponents[jsPathComponents.length - 2], longPath, longPath.substring(0, longPath.length - 3)];
    }
    const filename = jsPathComponents.pop();
    return [filename, filename.substring(0, filename.length - 3)];
  }
  let indexPath = pathRelativeToRoot;
  if (!indexPath.endsWith('/index.js')) {
    indexPath += '/index.js';
  }
  const indexContents = await executeCommand(`cat ${indexPath}`, repoName);
  if (!indexContents.includes('No such file or directory') && !indexContents.includes('Is a directory')) {
    const indexPathComponents = indexPath.split('/');
    // i.e. modules/code/codingTaskResolver/index.js
    // we return codingTaskResolver, codingTaskResolver/index, and codingTaskResolver/index.js
    const longPath = indexPathComponents.slice(indexPathComponents.length - 2).join('/');
    return [indexPathComponents[indexPathComponents.length - 2], longPath, longPath.substring(0, longPath.length - 3)];
  }
  throw new Error(`Could not find file ${pathRelativeToRoot}`);
}

const query = `
; Match ES6 import statements
(import_statement
  (import_clause (identifier) @defaultExport)
  source: (string) @path
)

(import_statement
  (import_clause 
    (named_imports 
      (import_specifier (identifier) @export)
    )
  )
  source: (string) @path
)

(import_statement
  (import_clause 
    (namespace_import (identifier) @namespace)
  )
  source: (string) @path
)

; Match require calls
(variable_declarator
  name: (identifier) @defaultExport
  value: (call_expression 
    function: (identifier) @function
    arguments: (arguments (string)) @path
    (#eq? @function "require"))
)

(variable_declarator
  name: (object_pattern (shorthand_property_identifier_pattern) @export)
  value: (call_expression 
    function: (identifier) @function
    arguments: (arguments (string)) @path
    (#eq? @function "require"))
)
`;

module.exports = { extractDependencies };