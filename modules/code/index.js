const { resolveCodingTask } = require('./codingTaskResolver');
const { pickCodeContext } = require('../search/output');
// const { resolveNonCodingTask, NonCoder } = require('./nonCodingTaskResolver');
// const { executeCommand } = require('../../dockerOperations');

async function resolveTasks(tasks, problemStatement, repoName) {
  for (const task of tasks) {
    const selectedContext = await pickCodeContext(task, problemStatement, repoName);
    // TODO: Maybe filter selectedContext w/ LLM or do some form of ranking.
    console.log('selectedContext', selectedContext);
    task.selectedContext = selectedContext; 
    await resolveCodingTask(task, problemStatement, repoName);
  }
}

module.exports = {
  resolveTasks
};