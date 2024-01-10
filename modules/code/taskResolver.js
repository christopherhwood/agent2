
const { prepareTaskResolutionQuery, prepareTaskResolutionConfirmationQuery } = require('./llmQueries');
const { queryLlmWithTools, iterateLlmQuery } = require('../../llmService');
const { generateSummary } = require('../summary');
const { CoderSystemPrompt, CodeReviewerSystemPrompt } = require('./systemPrompts');

async function resolveTask(targetTask, coder) {
  const tools = coder.getTools();
  // Get important code for the leaf task.
  const summary = await generateSummary(coder.repoName, targetTask.title + ' - ' + targetTask.description);
  // Prepare the query to resolve the task
  const query = prepareTaskResolutionQuery(targetTask, coder.rootTask, summary.summary, summary.fileCodeMap);
  const response = await queryLlmWithTools([{role: 'system', content: CoderSystemPrompt}, {role: 'user', content: query}], tools);
  console.log('Response from LLM:');
  console.log(response);
  // Execute response
  for (const toolCall of response) {
    if (toolCall.function == 'pass') {
      return;
    }
    await coder.routeToolCall(toolCall);
  }
  // Confirm execution & response
  await confirmTaskResolution(targetTask, coder.rootTask, CodeReviewerSystemPrompt, coder);
  // Commit changes
  await coder.commitChanges(targetTask);
  return;
}

async function recursivelyResolveTasks(task, coder) {
  if (task.subtasks.length == 0) {
    // Base case: task is a leaf task
    await resolveTask(task, coder);
    task.title = '~' + task.title + '~';
    task.description = '~' + task.description + '~';
    if (!task.commitHash) {
      return;
    }
    return;
  }

  for (const subtask of task.subtasks) {
    await recursivelyResolveTasks(subtask, coder);
  }
  task.title = '~' + task.title + '~';
  task.description = '~' + task.description + '~';
  return;
}

async function confirmTaskResolution(targetTask, topTask, systemPrompt, summary, coder) {
  // Get a git diff and pass in with the task. Get back any functions & run them, then repeat until you get a pass or we hit 3 iterations.
  // If we hit 3 iterations, revert the changes and return.

  // Get a git diff
  await coder.installDependencies();
  let lint = await coder.lint();
  let diff = await coder.gitDiff();
  // Prepare the query to confirm the resolution
  const query = prepareTaskResolutionConfirmationQuery(targetTask, topTask, summary.summary, summary.fileCodeMap, {lint, diff});

  async function refineTaskResolutionQuery(llmResponse) {
    if (llmResponse[0].function !== 'pass') {
      // Execute response
      for (const toolCall of llmResponse) {
        if (toolCall.function === 'pass') {
          continue;
        }
        const msg = await coder.routeToolCall(toolCall);
        if (msg) {
          return msg;
        }
      }
      lint = await coder.lint();
      diff = await coder.gitDiff();
    }
    return prepareTaskResolutionConfirmationQuery(targetTask, topTask, coder.fileCodeMap, {lint, diff});
  }

  function isTaskResolutionSufficientFunction(llmResponse) {
    return llmResponse[0].function === 'pass';
  }

  const queryFunction = (messageHistory) => {
    const tools = coder.getTools();
    return queryLlmWithTools(messageHistory, tools);
  };

  // Use iterateLlmQuery for the iterative confirmation process
  await iterateLlmQuery(query, refineTaskResolutionQuery, isTaskResolutionSufficientFunction, systemPrompt, queryFunction);
  return diff;
}

module.exports = {
  recursivelyResolveTasks
};