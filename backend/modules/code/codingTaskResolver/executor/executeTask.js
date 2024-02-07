const { executeCommand } = require('../../../../dockerOperations');
const Coder = require('./coder');
const { generateSpec } = require('./specCreator');

async function executeTask(task, problemStatement, styleGuide, repoName) {
  const spec = await generateSpec(task, problemStatement);
  const coder = new Coder(task, spec, styleGuide, repoName);
  await coder.resolveTask();
  // Add commit hash to the task
  task.commitHash = await executeCommand('git rev-parse HEAD', repoName);
}

module.exports = { executeTask };