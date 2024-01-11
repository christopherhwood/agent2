
const { prepareTaskResolutionQuery, prepareTaskResolutionConfirmationQuery } = require('./llmQueries');
const { selectKeyFiles } = require('../summary/codePicker');
const { queryLlmWithTools, iterateLlmQuery } = require('../../llmService');
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

  let fileContents = {};
  const keyFiles = await selectKeyFiles(coder.repoName, taskString);
  for (const fileName in keyFiles) {
    try {
      fileContents[fileName] = await coder.executeCommand(`cat ${fileName}`);
    } catch (err) {
      console.log(`Failed to cat ${fileName}`, err);
    }
  }
  // Prepare the query to resolve the task
  const query = prepareTaskResolutionQuery(taskString, fileContents);
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

  // update file contents
  for (const fileName in fileContents) {
    try {
      fileContents[fileName] = await coder.executeCommand(`cat ${fileName}`);
    } catch (err) {
      console.log(`Failed to cat ${fileName}`, err);
    }
  }

  // Confirm execution & response
  await confirmTaskResolution(taskString, CodeReviewerSystemPrompt, fileContents, coder);
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

async function confirmTaskResolution(taskString, systemPrompt, originalFileContents, coder) {
  // Get a git diff and pass in with the task. Get back any functions & run them, then repeat until you get a pass or we hit 3 iterations.
  // If we hit 3 iterations, revert the changes and return.

  let fileContents = originalFileContents;
  // Get a git diff
  await coder.installDependencies();
  let lint = await coder.lint();
  let diff = await coder.gitDiff();
  // Prepare the query to confirm the resolution
  const query = prepareTaskResolutionConfirmationQuery(taskString, fileContents, {lint, diff});

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
    // update file contents
    for (const fileName in fileContents) {
      try {
        fileContents[fileName] = await coder.executeCommand(`cat ${fileName}`);
      } catch (err) {
        console.log(`Failed to cat ${fileName}`, err);
      }
    }

    return prepareTaskResolutionConfirmationQuery(taskString, fileContents, {lint, diff});
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