
const { prepareTaskResolutionQuery, prepareTaskResolutionConfirmationQuery } = require('../llmQueries');
const { selectKeyFiles, getRepoContext } = require('../../summary/codePicker');
const { queryLlmWithTools, iterateLlmQuery } = require('../../../llmService');
const { CoderSystemPrompt, CodeReviewerSystemPrompt } = require('../systemPrompts');

async function resolveTask(targetTask, coder) {
  const tools = coder.getTools();
  const taskString = JSON.stringify(targetTask);

  let fileContents = {};
  const context = await getRepoContext(coder.repoName);
  let keyFiles = await selectKeyFiles(taskString, context);
  // Merge keyFiles & coder.fileContext without duplicates
  keyFiles = {files: [...new Set([...keyFiles.files, ...coder.fileContext])]};
  for (const fileName of keyFiles.files) {
    try {
      fileContents[fileName] = await coder.executeCommand(`cat ${fileName}`);
    } catch (err) {
      console.log(`Failed to cat ${fileName}`, err);
    }
  }
  // Prepare the query to resolve the task
  const query = prepareTaskResolutionQuery(taskString, fileContents);
  const { toolCalls, messages } = await queryLlmWithTools([{role: 'system', content: CoderSystemPrompt}, {role: 'user', content: query}], tools);
  console.log('Response from LLM:');
  console.log({toolCalls, message: messages[messages.length - 1]});
  // Execute response
  for (const toolCall of toolCalls) {
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
    if (llmResponse.toolCalls[0].function !== 'pass') {
      // Execute response
      for (const toolCall of llmResponse.toolCalls) {
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
    return llmResponse.toolCalls[0].function === 'pass';
  }

  const queryFunction = (messageHistory) => {
    const tools = coder.getTools();
    const response = queryLlmWithTools(messageHistory, tools);
    return response;
  };

  // Use iterateLlmQuery for the iterative confirmation process
  await iterateLlmQuery(query, refineTaskResolutionQuery, isTaskResolutionSufficientFunction, systemPrompt, queryFunction);
  return diff;
}

module.exports = {
  resolveTask 
};