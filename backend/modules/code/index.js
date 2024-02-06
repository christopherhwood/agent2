const { pickCodeContext } = require('../search/output');
const { resolveCodingTask } = require('./codingTaskResolver');

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
