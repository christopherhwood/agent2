// const { reviewCodeAndFileIssues } = require('./analyzer2/analyzeChanges');
// const { createTasksFromIssue } = require('./analyzer2/issueTaskCreator');
const { executeTask } = require('./executor/executeTask');
const Coder = require('./executor/coder');
// const { decideToContinue } = require('./analyzer2/taskReviser');

async function resolveCodingTask(task, problemStatement, coder) {
  await executeTask(task, problemStatement, coder);

  // // Walk through changes
  // const gitDiff = await coder.executeCommand('git diff -U5');
  // if (!gitDiff || gitDiff.length === 0) {
  //   return;
  // }
  // const issues = await reviewCodeAndFileIssues(task, coder, gitDiff);

  // if (issues && issues.length > 0) {

  //   const shouldContinue = await decideToContinue(task, issues, gitDiff);
  //   if (!shouldContinue) {
  //     throw new Error('Task abandoned');
  //   }
    
  //   let newTasks = [];
    
  //   for (const issue of issues) {
  //     const issueTasks = await createTasksFromIssue(issue, task, gitDiff);
  //     newTasks = newTasks.concat(issueTasks);
  //   }
  //   for (const issueTask of newTasks) {
  //     issueTask.isIssue = true;
  //     await resolveCodingTask(issueTask, coder);
  //   }
  // }

  if (!task.isIssue) {
    // Commit changes and return
    await coder.commitChanges(task);
    return;
  }
}

module.exports = { resolveCodingTask, Coder };
