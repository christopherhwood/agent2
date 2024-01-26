const IntegrationExpert = require('./integrationExpert');
const { discernFilesToBeEditedAndIntegrated } = require('./keyFileDiscerner');
const { queryLlmWTools } = require('../../../../llmService');
const { adjustTask } = require('./adjustTask');

async function executeTask(task, coder) {
  const taskString = createTaskString(task);
  
  const context = await coder.getRepoContext();
  const keyFiles = await coder.selectKeyFiles(taskString);

  const keyFilesForDiscerner = (await Promise.all(keyFiles.map(async (fileName) => {
    try {
      const contents = await coder.executeCommand(`cat ${fileName}`);
      return { [fileName]: contents };
    } catch (err) {
      console.log(`Failed to cat ${fileName}`, err);
      return {};
    }
  }))).reduce((acc, fileContents) => ({ ...acc, ...fileContents }), {});

  const { toBeEdited, toBeImported } = await discernFilesToBeEditedAndIntegrated(taskString, keyFilesForDiscerner);

  let integrationExperts = [];
  for (const fileName of toBeImported) {
    integrationExperts.push(new IntegrationExpert(fileName, keyFilesForDiscerner[fileName]));
  }

  let keyFilesForResolver = {};
  for (const fileName of toBeEdited) {
    keyFilesForResolver[fileName] = keyFilesForDiscerner[fileName];
  }

  const integrationAdvice = await Promise.all(integrationExperts.map(async (integrationExpert) => {
    try {
      const advice = await integrationExpert.getAdvice(taskString);
      if (advice.functions.length === 0) {
        return null;
      }
      return advice;
    } catch (err) {
      console.log(`Failed to get advice for ${integrationExpert.fileName}`, err);
      return null;
    }
  }).filter((promise) => promise !== null));

  const adjustedTask = await adjustTask(task, coder.originalGoal, integrationAdvice, keyFilesForResolver);

  const adjustedTaskString = createTaskString(adjustedTask);

  const query = taskResolutionQuery(adjustedTaskString, context, integrationAdvice, keyFilesForResolver);

  coder.integrationExperts = integrationExperts;
  const message = await queryLlmWTools([{role: 'system', content: ExecuteTaskSystemPrompt}, {role: 'user', content: query}], coder.getTools(), coder);
  coder.integrationExperts = [];
  return message;
}

const ExecuteTaskSystemPrompt = `You are an expert JavaScript developer who uses a set of functions to do all of your work. Your main responsibility is to assess JavaScript coding tasks and determine the most efficient way to resolve them using the available set of tools. These tools include creating, deleting, and modifying files, as well as executing commands in the terminal. When you write code, your changes will be written directly to file. There is no one else in the loop to review your code. You are responsible for ensuring that your code is of high quality and adheres to JavaScript best practices. Do not leave TODO comments, placeholders, or things to follow up on later. No one will follow your suggestions or clean up your code.

Do NOT bridge code edits with comments like "rest of code here" or "at the end, add this". Instead use 2 or more separate edit functions.

Tasks consist of the task content, completion criteria, and potentially suggested pseudocode, background context, recent & related commits, and tips from our team of integration experts.

When presented with a task, your first step is to analyze it thoroughly, understanding the requirements and nuances of the task. Based on this analysis, you will then select one or more of the available tools that best suit the task's needs. The tools at your disposal are:

1. \`createFile\`: For creating new files with specified contents. If the file exists it will be overwritten with the new contents. **IMPORTANT**: The new contents will be copied into the file _exactly_ as written.
2. \`deleteFile\`: For deleting files that are no longer needed.
3. \`editCode\`: For replacing an existing code snippet with a new code snippet at the specified path. **IMPORTANT**: The original code must match _exactly_ the code in the file, otherwise the command will fail. The new code will be copied into the file _exactly_ as written.
4. \`executeCommand\`: For running terminal commands such as npm install or npm start.
5. \`pass\`: For passing the task without taking any action.

Your output should be a series of commands for these tools that will collectively resolve the task. Each command must be specific and detailed, clearly stating the action to be taken, the target file (if applicable), and the exact code or command to be executed. The goal is to fully resolve the task through these commands, ensuring that they are practical, efficient, and aligned with JavaScript best practices.

Attempt to solve your tasks in the simplest, most straightforward way possible. Do not overcomplicate your solutions. Strive to use less code when possible. Avoid adding superfluous code or unnecessary complexity. However, also strive to deliver the best solution. When these two values come into conflict, pefer simpler solutions over more complex ones.

If tasks are already completed or are not relevant to the current coding task, you may use the \`pass\` tool to skip them. Do not add unecessary logging or unecessary error handling just to satisfy a task. Use your best judgement for what makes sense to do on every task.

Remember, your role is to bridge the gap between a high-level task description and the low-level actions required to complete it, thereby streamlining the coding process and enhancing productivity.

You must respond with at least one tool command, but you may return multiple commands if you deem it necessary. Use the \`pass\` tool command if no action is required. DO NOT leave important context in your response content. Any content in your response will be ignored.`;

const createTaskString = (task) => {
  let str = `# ${task.taskId} : '${task.title}'\n\n`;
  str += `${task.description}\n\n`;
  if (task.pseudocode && task.pseudocode.length > 0 && !task.pseudocode.includes('N/A')) {
    str += '**Pseudocode:**\n';
    str += '```\n';
    str += `${task.pseudocode}\n`;
    str += '```\n\n';
  }
  str += '**Completion Criteria:**\n';
  str += task.completionCriteria + '\n\n';
  if (task.backgroundContext && task.backgroundContext.length > 0) {
    str += '## Background Context\n\n';
    str += task.backgroundContext + '\n\n';
  }
  if (task.relatedCommits && task.relatedCommits.length > 0) {
    str += '## Recent & Related Commits\n\n';
    str += task.relatedCommits + '\n\n';
  }
  return str;
};

const taskResolutionQuery = (taskString, context, integrationAdvice, keyFiles) => {
  let query = taskString + '\n\n';
  query += '## Repository Directory Tree\n';
  query += context.directoryTree + '\n\n';
  if (integrationAdvice.length > 0) {
    query += '## Integration Advice for Relevant Existing Code\n\n';
    for (const advice of integrationAdvice) {
      query += '```json\n';
      query += `${JSON.stringify(advice)}\n`;
      query += '```\n\n';
    }
  }
  if (Object.keys(keyFiles).length > 0) {
    query += '## Key Files\n\n';
    for (const keyFile of Object.keys(keyFiles)) {
      query += `**${keyFile}**\n\n`;
      query += '```javascript\n';
      query += `${keyFiles[keyFile]}\n`;
      query += '```\n\n';
    }
  }
  query += '## Request\n';
  query += 'Use the tools at your disposal to resolve the above task. ';
  query += 'Use multiple tools if necessary, including multiple instances of the same tool. ';
  query += 'If no changes are required, use the pass function in your tools. ';
  return query;
};

module.exports = { executeTask };