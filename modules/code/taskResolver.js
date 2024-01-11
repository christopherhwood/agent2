
const { prepareTaskResolutionQuery, prepareTaskResolutionConfirmationQuery } = require('./llmQueries');
const { queryLlmWithTools, iterateLlmQuery } = require('../../llmService');
const { generateSummary } = require('../summary');
const { CoderSystemPrompt, CodeReviewerSystemPrompt } = require('./systemPrompts');

async function resolveTask(targetTask, coder) {
  const tools = coder.getTools();
  // Get important code for the leaf task.
  let taskString = '# Task\n';
  const buildTaskTree = (level, task) => {
    // Build a query like: 
    // ## Top Level Task Title
    // Top Level Task Description
    // ### Child Task Title
    // Child Task Description
    if (task === targetTask) {
      taskString += `${'  '.repeat(level * 2)} - Subtask: ${task.title}\n`;
    } else {
      taskString += `${'  '.repeat(level * 2)} ${level === 0 ? 'Main Task' : '- Subtask'} ${task.title}\n`;
    }
    taskString += `${'  '.repeat(level * 2 + 1)} - Description: ${task.description}\n`;
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        if (!buildTaskTree(level + 1, subtask)) {
          return false;
        }
      }
    } else if (task.title[0] !== '~') {
      return false;
    }
    return true;
  };
  buildTaskTree(0, coder.rootTask);
  const summary = await generateSummary(coder.repoName, taskString);
  // Prepare the query to resolve the task
  const query = prepareTaskResolutionQuery(taskString, summary.summary, summary.fileCodeMap);
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
  await confirmTaskResolution(taskString, CodeReviewerSystemPrompt, summary, coder);
  // Commit changes
  await coder.commitChanges(targetTask);
  return;
}

async function recursivelyResolveTasks(task, coder) {
  if (!task.subtasks || task.subtasks.length == 0) {
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

async function confirmTaskResolution(taskString, systemPrompt, summary, coder) {
  // Get a git diff and pass in with the task. Get back any functions & run them, then repeat until you get a pass or we hit 3 iterations.
  // If we hit 3 iterations, revert the changes and return.

  // Get a git diff
  await coder.installDependencies();
  let lint = await coder.lint();
  let diff = await coder.gitDiff();
  // Prepare the query to confirm the resolution
  const query = prepareTaskResolutionConfirmationQuery(taskString, summary.summary, summary.fileCodeMap, {lint, diff});

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
    return prepareTaskResolutionConfirmationQuery(taskString, coder.fileCodeMap, {lint, diff});
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