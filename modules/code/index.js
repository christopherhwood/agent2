const { resolveCodingTask, Coder } = require('./codingTaskResolver');
const { resolveNonCodingTask, NonCoder } = require('./nonCodingTaskResolver');
const { executeCommand } = require('../../dockerOperations');

async function resolveTasks(tasks, originalGoal, repoName) {
  const nonCoder = await NonCoder.Create(repoName);
  const coder = new Coder(originalGoal, repoName);

  let resolvedTaskIds = [];
  let waitingTasks = [...tasks];
  
  const nonCoderTaskOutputs = [];
  const coderCommitDetails = new Set();

  try {
    while (waitingTasks.length > 0) {
      // Union coder fileContext & nonCoder fileContext
      coder.fileContext = new Set([...coder.fileContext, ...nonCoder.fileContext]);
  
      let currentTaskIndex = waitingTasks.findIndex(task => task.dependencies.every(dependency => resolvedTaskIds.includes(dependency)));
      
      if (currentTaskIndex !== -1) {
        let currentTask = waitingTasks[currentTaskIndex];
        if (nonCoderTaskOutputs.length > 0) {
          currentTask.backgroundContext = nonCoderTaskOutputs.join('\n');
        }
        if (coderCommitDetails.size > 0) {
          currentTask.relatedCommits = [...coderCommitDetails].join('\n');
        }
        
        if (currentTask.pseudocode && currentTask.pseudocode.length > 0 && !currentTask.pseudocode.includes('N/A')) {
          await resolveCodingTask(currentTask, coder);
          // Get commit details from last task
          const commitDetails = await executeCommand(`git show ${currentTask.commitHash}`, repoName);
          coderCommitDetails.add(commitDetails);
        } else {
          const output = await resolveNonCodingTask(currentTask, nonCoder);
          nonCoderTaskOutputs.push(output);
        }
        
        resolvedTaskIds.push(currentTask.taskId);
        // Remove the task from the waiting list, preserving all other tasks in the list.
        waitingTasks.splice(currentTaskIndex, 1);
      } else {
        throw new Error('Unable to start on remaining tasks. Double check the dependencies: ' + waitingTasks.map(task => JSON.stringify(task)).join('\n'));
      }
    }
  } finally {
    await nonCoder.destroy();
  }
}

module.exports = {
  resolveTasks
};