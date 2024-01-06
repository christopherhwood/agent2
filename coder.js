const { prepareTaskResolutionQuery, prepareTaskResolutionConfirmationQuery } = require('./llmQueries.js');
const { queryLlmWithTools, iterateLlmQuery } = require('./llmService.js');
const { createContainer, destroyContainer, executeCommand } = require('./dockerOperations.js');

async function resolveTasks(topTask, keyFilesAndCommits, repoName) {
  const coder = new Coder(repoName, keyFilesAndCommits);

  const resolveTask = async (targetTask) => {
    const tools = coder.getTools();
    const systemPrompt = getCoderSystemPrompt();
    // Prepare the query to resolve the task
    const query = prepareTaskResolutionQuery(targetTask, topTask, JSON.stringify(coder.keyFilesAndCommits));
    const response = await queryLlmWithTools([{role: 'system', content: systemPrompt}, {role: 'user', content: query}], tools);
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
    await confirmTaskResolution(targetTask, topTask, getReviewerSystemPrompt(), coder);
    // Commit changes
    await coder.commitChanges(targetTask);
    return;
  };
  const recursivelyResolveTasks = async (task) => {
    if (task.subtasks.length == 0) {
      // Base case: task is a leaf task
      await resolveTask(task);
      task.title = '~' + task.title + '~';
      task.description = '~' + task.description + '~';
      if (!task.commitHash) {
        return;
      }
      return;
    }

    for (const subtask of task.subtasks) {
      await recursivelyResolveTasks(subtask);
    }
    task.title = '~' + task.title + '~';
    task.description = '~' + task.description + '~';
    return;
  };
  
  // Start the resolution process from the root task
  await recursivelyResolveTasks(topTask);
}

async function confirmTaskResolution(targetTask, topTask, systemPrompt, coder) {
  // Get a git diff and pass in with the task. Get back any functions & run them, then repeat until you get a pass or we hit 3 iterations.
  // If we hit 3 iterations, revert the changes and return.

  // Get a git diff
  await coder.installDependencies();
  let lint = await coder.lint();
  let diff = await coder.gitDiff();
  // Prepare the query to confirm the resolution
  const query = prepareTaskResolutionConfirmationQuery(targetTask, topTask, JSON.stringify(coder.keyFilesAndCommits), {lint, diff});

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
    return prepareTaskResolutionConfirmationQuery(targetTask, topTask, JSON.stringify(coder.keyFilesAndCommits), {lint, diff});
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
  

class Coder {
  constructor(repoName, keyFilesAndCommits) {
    this.repoName = repoName;
    this.keyFilesAndCommits = keyFilesAndCommits;
    this.filesToAdd = [];
    this.filesToRemove =[];
  }

  async commitChanges(task) {
    const container = await createContainer(this.repoName);

    // Commit the changes to git  
    await executeCommand(`git add . && git commit -m  "${task.title}\n\n${task.description}"`, this.repoName, container);
    
    // Refresh key files & commits
    const keyFiles = this.keyFilesAndCommits.keyFiles;
    for (const file of keyFiles) {
      const blame = await executeCommand(`git --no-pager blame ${file.name}`, this.repoName, container);
      const history = await executeCommand(`git --no-pager log -n 3 --pretty=format:"%h - %an, %ar : %s" -- ${file.name}`, this.repoName, container);
      file.blame = blame;
      file.history = history;
    }
    const keyCommits = executeCommand('git --no-pager log -n 5 --pretty=format:"%h - %an, %ar : %s"', this.repoName, container);
    this.keyFilesAndCommits = { keyFiles: keyFiles, keyCommits: keyCommits };

    // Add and remove key files as necessary
    for (const fileToAdd of this.filesToAdd) {
      const blame = await executeCommand(`git --no-pager blame ${fileToAdd}`, this.repoName, container);
      const history = await executeCommand(`git --no-pager log -n 3 --pretty=format:"%h - %an, %ar : %s" -- ${fileToAdd}`, this.repoName, container);
      this.keyFilesAndCommits.keyFiles.push({ name: fileToAdd, blame: blame, history: history });
    }
    for (const fileToRemove of this.filesToRemove) {
      this.keyFilesAndCommits.keyFiles = this.keyFilesAndCommits.keyFiles.filter(file => file.name !== fileToRemove);
    }

    // Add commit hash to the task
    task.commitHash = await executeCommand('git rev-parse HEAD', this.repoName, container);

    await destroyContainer(container);
    this.filesToAdd = [];
    this.filesToRemove = [];
  }
  
  async createFile(path, contents) {
    // mkdir for all paths but make sure to exclude filename
    await executeCommand(`mkdir -p ${path.substring(0, path.lastIndexOf('/'))} && echo "${contents}" > ${path}`, this.repoName);
    this.filesToAdd.push(path);
  }

  async deleteFile(path) {
    await executeCommand(`rm ${path}`, this.repoName);
    this.filesToRemove.push(path);
  }

  async editCode(path, originalCode, newCode) {
    // Create a container
    const container = await createContainer(this.repoName);

    // Echo the code to a temp file in the container
    await executeCommand(`echo "${newCode}" > /usr/src/temp`, this.repoName, container);

    await executeCommand(`echo "${originalCode}" > /usr/src/original`, this.repoName, container);
    
    // Insert the code into the specified file using the /usr/bin/insertCode.js script
    const output = await executeCommand(`/usr/bin/replaceCode.js ${path} /usr/src/original /usr/src/temp`, this.repoName, container);
    
    // Destroy the container
    await destroyContainer(container);
    return output;
  }

  async executeCommand(command) {
    await executeCommand(command, this.repoName);
  }

  async installDependencies() {
    return await executeCommand('npm install', this.repoName);
  }

  async lint() {
    return await executeCommand('npm run lint', this.repoName);
  }

  async runTests() {
    return await executeCommand('npm run test', this.repoName);
  }

  async gitDiff() {
    return await executeCommand('git add . && git --no-pager diff --staged', this.repoName);
  }

  getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'createFile',
          description: 'Creates a new file with the provided contents. Useful for creating new files for functions or logic that does not belong in existing files.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to create. Paths must be relative to the root of the repository.'
              },
              contents: {
                type: 'string',
                description: 'The contents to write to the file.'
              }
            },
            required: ['path', 'contents']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteFile',
          description: 'Deletes the file at the provided path. Useful for deleting files that are no longer needed.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to delete. Paths must be relative to the root of the repository.'
              }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'editCode',
          description: 'Replaces the original code snippet with the new code snippet at the provided path. Useful for modifying existing code.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to modify. Paths must be relative to the root of the repository.'
              },
              originalCode: {
                type: 'string',
                description: 'The code snippet to replace.'
              },
              newCode: {
                type: 'string',
                description: 'The new code snippet to insert.'
              }
            },
            required: ['path', 'originalCode', 'newCode']
          }
        }
      },
      {
        type: 'function', 
        function: {
          name: 'executeCommand',
          description: 'Executes the provided command in the terminal. Useful for running commands such as npm install or npm start.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command to execute.'
              }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pass',
          description: 'Passes the task without taking any action. Useful for tasks that do not require any action, such as tasks that are already completed or tasks that are not relevant to the current coding task. This is a no-op.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      }
    ];
  }

  async routeToolCall(toolCall) {
    return await this[toolCall.function](...Object.values(toolCall.arguments));
  }
}

function getCoderSystemPrompt() {
  return `You are a JavaScript coding assistant, specialized in automating the development process by executing specific tool commands. Your main responsibility is to assess JavaScript coding tasks and determine the most efficient way to resolve them using the available set of tools. These tools include creating, deleting, and modifying files, as well as executing commands in the terminal.

  When presented with a task, your first step is to analyze it thoroughly, understanding the requirements and nuances of the task. Based on this analysis, you will then select one or more of the available tools that best suit the task's needs. The tools at your disposal are:
  
  1. \`createFile\`: For creating new files with specified contents. If the file exists it will be overwritten with the new contents.
  2. \`deleteFile\`: For deleting files that are no longer needed.
  3. \`editCode\`: For replacing an existing code snippet with a new code snippet at the specified path.
  4. \`executeCommand\`: For running terminal commands such as npm install or npm start.
  5. \`pass\`: For passing the task without taking any action.
  
  Your output should be a series of commands for these tools that will collectively resolve the task. Each command must be specific and detailed, clearly stating the action to be taken, the target file (if applicable), and the exact code or command to be executed. The goal is to fully resolve the task through these commands, ensuring that they are practical, efficient, and aligned with JavaScript best practices.

  If tasks are already completed or are not relevant to the current coding task, you may use the \`pass\` tool to skip them. Do not add unecessary logging or unecessary error handling just to satisfy a task. Use your best judgement for what makes sense to do on every task.
  
  Remember, your role is to bridge the gap between a high-level task description and the low-level actions required to complete it, thereby streamlining the coding process and enhancing productivity.
  
  You must respond with at least one tool command, but you may return multiple commands if you deem it necessary. Use the \`pass\` tool command if no action is required. DO NOT leave important context in your response content. Any content in your response will be ignored.
  
  Tasks with a strikethrough have already been completed and are only shared for context.`;
}

function getReviewerSystemPrompt() {
  return `You are a JavaScript code review assistant, specialized in analyzing and correcting code changes (diffs) made in response to specific tasks. Your primary responsibility is to scrutinize the submitted diffs to ensure they accurately and effectively accomplish the given task. If the diff is satisfactory, you will use the \`pass\` tool to approve it. If it requires modifications, you will utilize the available tools to make necessary corrections.

  When presented with a diff, your first step is to review it thoroughly, comparing it against the task's requirements. Assess the quality of the changes, their alignment with JavaScript best practices, and their effectiveness in fulfilling the task. Based on this review, you will decide whether to approve the diff or to make corrections. The tools at your disposal are:
  
  1. \`createFile\`: For creating new files with specified contents. If the file exists it will be overwritten with the new contents.
  2. \`deleteFile\`: For deleting files that are no longer needed.
  3. \`editCode\`: For replacing an existing code snippet with a new code snippet at the specified path.
  4. \`executeCommand\`: For running terminal commands such as npm install or npm start.
  5. \`pass\`: For approving the diff without any modifications.
  
  Your output should be either the \`pass\` command if the diff meets the task's requirements, or a series of specific, detailed tool commands to correct any deficiencies in the diff. Each correction command must clearly state the action to be taken, the target file, and the precise modifications or code to be executed. Your goal is to ensure the final code aligns with the task's objectives and adheres to high standards of quality and best practices.

  Be on the lookout for duplicate sounding comments that can be consolidated into a single comment. Also, be on the lookout for unecessary logging or unecessary error handling that can be removed. Fix things that are in poor style or would be flagged during a code review. You are responsible for making this code as clean and concise as possible.
  
  Remember, your role is critical in ensuring that the code not only meets the task's technical requirements but also maintains the integrity and quality of the overall project. Your output should either validate the submitted work or provide clear, actionable steps to refine it.
  
  Tasks with a strikethrough have already been completed and are only shared for context.`;
}

module.exports = { resolveTasks };