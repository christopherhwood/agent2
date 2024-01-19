const { queryLlmWTools } = require('../../../../llmService');

async function executeTask(task, coder) {
  const taskString = createTaskString(task);
  
  const context = await coder.getRepoContext();
  const keyFiles = await coder.selectKeyFiles(taskString);
  let fileContents = {};

  const fileContentsPromises = keyFiles.map(async (fileName) => {
    try {
      return { fileName: await coder.executeCommand(`cat ${fileName}`) };
    } catch (err) {
      console.log(`Failed to cat ${fileName}`, err);
      return { fileName: null };
    }
  });
  const fileContentsArray = await Promise.all(fileContentsPromises);
  fileContentsArray.forEach((fileContent) => {
    fileContents = { ...fileContents, ...fileContent };
  });

  const query = taskResolutionQuery(taskString, context, fileContents);

  const message = await queryLlmWTools([{role: 'system', content: ExecuteTaskSystemPrompt}, {role: 'user', content: query}], coder.getTools(), coder);
  return message;
}

const ExecuteTaskSystemPrompt = `You are an expert JavaScript coding assistant, specialized in automating the development process by executing specific tool commands. Your main responsibility is to assess JavaScript coding tasks and determine the most efficient way to resolve them using the available set of tools. These tools include creating, deleting, and modifying files, as well as executing commands in the terminal. When you write code, your changes will be written directly to file. There is no human in the loop to review your code. You are responsible for ensuring that your code is of high quality and adheres to JavaScript best practices. Do not leave TODO comments, placeholders, or things to follow up on later. No one will follow your suggestions or clean up your code.

Do NOT bridge code edits with comments like "rest of code here" or "at the end, add this". Instead use 2 or more separate edit functions.

Tasks consist of the task content, completion criteria, and potentially suggested pseudocode, background context, or recent & related commits. Use this information to help you resolve the task. The content of key files related to the task and the repository's directory tree are also provided to aid you in your work. When making code edits, understand that code in the recent & related commits section is a diff view of the code changed in that commit. The code under Key Files is the current code in the repository.

When presented with a task, your first step is to analyze it thoroughly, understanding the requirements and nuances of the task. Based on this analysis, you will then select one or more of the available tools that best suit the task's needs. The tools at your disposal are:

1. \`createFile\`: For creating new files with specified contents. If the file exists it will be overwritten with the new contents.
2. \`deleteFile\`: For deleting files that are no longer needed.
3. \`editCode\`: For replacing an existing code snippet with a new code snippet at the specified path.
4. \`executeCommand\`: For running terminal commands such as npm install or npm start.
5. \`pass\`: For passing the task without taking any action.

Your output should be a series of commands for these tools that will collectively resolve the task. Each command must be specific and detailed, clearly stating the action to be taken, the target file (if applicable), and the exact code or command to be executed. The goal is to fully resolve the task through these commands, ensuring that they are practical, efficient, and aligned with JavaScript best practices.

If tasks are already completed or are not relevant to the current coding task, you may use the \`pass\` tool to skip them. Do not add unecessary logging or unecessary error handling just to satisfy a task. Use your best judgement for what makes sense to do on every task.

Remember, your role is to bridge the gap between a high-level task description and the low-level actions required to complete it, thereby streamlining the coding process and enhancing productivity.

You must respond with at least one tool command, but you may return multiple commands if you deem it necessary. Use the \`pass\` tool command if no action is required. DO NOT leave important context in your response content. Any content in your response will be ignored.`;

const createTaskString = (task) => {
  let str = `# ${task.taskId} : '${task.title}'\n\n`;
  str += `${task.description}\n\n`;
  if (task.pseudocode && task.pseudocode.length > 0 && task.pseudocode !== 'N/A') {
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

const taskResolutionQuery = (taskString, context, fileContents) => {
  let query = taskString + '\n\n';
  query += '## Repository Context\n';
  query += '**Directory Tree:**\n';
  query += '```\n';
  query += `${context.directoryTree}\n`;
  query += '```\n';
  if (Object.keys(fileContents).length > 0) {
    query += '## Key Files\n\n';
    for (const fileName of Object.keys(fileContents)) {
      query += `**${fileName}:**\n`;
      query += `\`\`\`\n${fileContents[fileName]}\n\`\`\`\n\n`;
    }
  }
  query += '## Request\n';
  query += 'Use the tools at your disposal to resolve the above task. ';
  query += 'Use multiple tools if necessary, including multiple instances of the same tool. ';
  query += 'If no changes are required, use the pass function in your tools. ';
  return query;
};

module.exports = { executeTask };