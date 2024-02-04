const { executeCommand } = require('../../../../dockerOperations');
const Coder = require('./coder');
const { generateSpec } = require('./specCreator');

async function executeTask(task, problemStatement, repoName) {
  const spec = await generateSpec(task, problemStatement);
  const coder = new Coder(task, spec, repoName);
  await coder.resolveTask();
  // Add commit hash to the task
  task.commitHash = await executeCommand('git rev-parse HEAD', this.repoName);
}

module.exports = { executeTask };