// const { executeCommand } = require('../../../../dockerOperations');
const { findIncorrectAsyncUsage } = require('./errors/checkAsync');
const { findIncorrectDependencies } = require('./errors/checkImports');
const { validateJsDocComments } = require('./errors/checkJSDocComment');
// const { gatherImportedFunctionCallContext } = require('./warnings/gatherImportedFunctionCallContext');

async function analyzeNewCode(newCode, filePath, repoName) {
  const warnings = [];
  const errors = [];
  
  const asyncErrors = findIncorrectAsyncUsage(newCode);
  const importErrors = await findIncorrectDependencies(newCode, filePath, repoName);
  const commentErrors = validateJsDocComments(newCode);

  // const fullCode = await executeCommand(`cat ${filePath}`, repoName);
  // const extraContext = await gatherImportedFunctionCallContext(newCode, fullCode, filePath, repoName);

  errors.push(...asyncErrors);
  errors.push(...importErrors);
  errors.push(...commentErrors);

  // console.log('extraContext', extraContext);
  // for (const dependencyPath of Object.keys(extraContext)) {
  //   let message = `WARNING: You have used a new dependency in this file. Please double check that the usage is correct. To aid you, we are providing the source code from the dependent file as well as some example usage from elsewhere in the codebase.\n    - **${dependencyPath}**\n    - Dependency Source Code:\n\`\`\`\n${extraContext[dependencyPath].fileContents}\n\`\`\`\n`;
  //   if (extraContext[dependencyPath].exampleUsages && extraContext[dependencyPath].exampleUsages.length > 0) {
  //     message += '    - Snippets of Example Usage from Codebase:\n';
  //     for (const usage of extraContext[dependencyPath].exampleUsages) {
  //       message += `\`\`\`\n${usage}\n\`\`\`\n`;
  //     }
  //   } else {
  //     message = 'URGENT ' + message;
  //     message += '    - No example usage similar to your usage found in the codebase. This is almost certainly a bug. Double check with the source code above that the import statement is correct.';
  //   }
  //   warnings.push({
  //     message
  //   });
  // }
  return { errors, warnings };
}

module.exports = { analyzeNewCode };