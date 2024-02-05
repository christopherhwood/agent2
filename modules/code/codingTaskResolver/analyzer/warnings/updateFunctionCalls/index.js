const { detectChangedFunctionSignatures } = require('./detectChangedFunctionSignature');
const { tagFunctionCallSites } = require('./tagFunctionCallSites');

async function warnAboutInvalidFunctionCalls(oldCode, newCode, repoName) {
  const changedFunctions = detectChangedFunctionSignatures(oldCode, newCode);
  console.log('changedFunctions:', JSON.stringify(changedFunctions));
  if (changedFunctions.functionsWithChangedParams.length > 0 || changedFunctions.deletedFunctions.length > 0) {
    await tagFunctionCallSites(changedFunctions, repoName);
    let warning = 'The following function calls may be invalid due to changes in the function signature:\n';
    for (const func of changedFunctions.functionsWithChangedParams) {
      warning += `Function ${func.name} has changed parameters. Call sites:\n${func.callSites.join('\n')}\n`;
    }
    for (const func of changedFunctions.deletedFunctions) {
      warning += `Function ${func.name} has been deleted or renamed. Call sites:\n${func.callSites.join('\n')}\n`;
    }
    return warning;
  }
  return null;
}

module.exports = { warnAboutInvalidFunctionCalls };
