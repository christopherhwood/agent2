const { reviewCodeAndFileIssues } = require('./analyzer/analyzeChanges');
const { createTasksFromIssue } = require('./analyzer/issueTaskCreator');
const { executeTask } = require('./executor/executeTask');
const Coder = require('./executor/coder');

async function resolveCodingTask(task, coder) {
  await executeTask(task, coder);

  // Walk through changes
  const issues = await reviewCodeAndFileIssues(task, coder);

  if (issues && issues.length > 0) {
    let newTasks = [];
    for (const issue of issues) {
      const issueTasks = await createTasksFromIssue(issue, task, coder);
      newTasks = newTasks.concat(issueTasks);
    }
    for (const issueTask of newTasks) {
      issueTask.isIssue = true;
      await resolveCodingTask(issueTask, coder);
    }
  }

  if (!task.isIssue) {
    // Commit changes and return
    await coder.commitChanges(task);
    return;
  }
}

module.exports = { resolveCodingTask, Coder };
