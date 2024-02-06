const { detectChangedFunctionSignatures } = require('./detectChangedFunctionSignature');
const { tagFunctionCallSites } = require('./tagFunctionCallSites');
const { detectChangedReturnTypes } = require('./detectChangedReturnTypes');

async function warnAboutInvalidFunctionCalls(oldCode, newCode, repoName) {
  const changedFunctions = detectChangedFunctionSignatures(oldCode, newCode);
  const functionsWithChangedReturnTypes = detectChangedReturnTypes(oldCode, newCode);
  console.log('changedFunctions:', JSON.stringify(changedFunctions));
  console.log('functionsWithChangedReturnTypes:', JSON.stringify(functionsWithChangedReturnTypes));
  if (changedFunctions.functionsWithChangedParams.length > 0 || changedFunctions.deletedFunctions.length > 0 || changedFunctions.functionsWithChangedReturnTypes.length > 0) {
    await tagFunctionCallSites(changedFunctions, repoName);
    let warning = 'The following function calls may be invalid due to changes in the function signature:\n';
    for (const func of changedFunctions.functionsWithChangedParams) {
      warning += `Function ${func.name} has changed parameters. Call sites:\n${func.callSites.join('\n')}\n`;
    }
    for (const func of changedFunctions.deletedFunctions) {
      warning += `Function ${func.name} has been deleted or renamed. Call sites:\n${func.callSites.join('\n')}\n`;
    }
    for (const func of functionsWithChangedReturnTypes) {
      warning += `Function ${func.functionName} has changed its return type from ${func.oldReturnTypes.join(' | ')} to ${func.newReturnTypes.join(' | ')}. This may affect existing logic that relies on the previous return type. Please review and update the call sites as necessary.\n`;
    }
    return warning;
  }
  return null;
}

module.exports = { warnAboutInvalidFunctionCalls };
