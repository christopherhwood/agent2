const { executeCommand } = require('../../../../../dockerOperations');
const { extractDependencies } = require('../../../../summary/analysis/dependencyAnalysis');

async function findIncorrectDependencies(fileContents, basePath, repoName) {
  const dependencies = await extractDependencies(fileContents, basePath, repoName);

  let errors = [];
  await dependencies.local.forEach(async (dep) => {
    // Check that file exists
    if (!await dependencyExists(dep.pathRelativeToRoot, repoName)) {
      errors.push({ message: `File ${dep.pathRelativeToRoot} does not exist.`, line: dep.line, column: dep.column , code: dep.code });
    }
  });

  // TODO verify external deps have been added w/ npm already
  
  return errors;
}

async function dependencyExists(pathRelativeToRepoRoot, repoName) { 
  let jsPath = pathRelativeToRepoRoot;
  if (!jsPath.endsWith('.js')) {
    jsPath += '.js';
  }
  const exists = await fileExists(jsPath, repoName);
  if (exists) {
    return true;
  }
  let indexPath = pathRelativeToRepoRoot;
  if (!indexPath.endsWith('/index.js')) {
    indexPath += '/index.js';
  }
  return await fileExists(indexPath, repoName);
}

async function fileExists(pathRelativeToRepoRoot, repoName) {
  try {
    const output = await executeCommand(`test -f ${pathRelativeToRepoRoot} && echo "File exists" || echo "File does not exist"`, repoName);
    return output.includes('File exists');
  } catch (err) {
    console.error('Error checking if file exists. ', err);
    return false;
  }
}

module.exports = { findIncorrectDependencies };