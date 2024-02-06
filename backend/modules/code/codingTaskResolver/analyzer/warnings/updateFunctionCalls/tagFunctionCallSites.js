const { executeCommand } = require('../../../../../../dockerOperations');

// { functionsWithChangedParams, deletedFunctions }
async function tagFunctionCallSites(changedFunctions, repoName) {
  for (const func of changedFunctions.functionsWithChangedParams) {
    const command = `git ls-files | xargs grep -r -n -F "${func.name}"`;
    const result = await executeCommand(command, repoName);
    func.callSites = result.split('\n').filter(line => line.trim().length > 0);
  }
  for (const func of changedFunctions.deletedFunctions) {
    const command = `git ls-files | xargs grep -r -n -F "${func.name}"`;
    const result = await executeCommand(command, repoName);
    func.callSites = result.split('\n').filter(line => line.trim().length > 0);
  }
  return changedFunctions;
}

module.exports = { tagFunctionCallSites };
