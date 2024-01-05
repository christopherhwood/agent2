const { prepareTaskResolutionQuery } = require('./llmQueries.js');
const { queryLlmWithTools } = require('./llmService.js');
const { createContainer, destroyContainer, executeCommand } = require('./dockerOperations.js');

async function resolveTasks(topTask, keyFilesAndCommits, repoName) {
  const coder = new Coder(repoName);

  const resolveTask = async (targetTask) => {
    const tools = coder.getTools();
    const systemPrompt = getSystemPrompt();
    // Prepare the query to resolve the task
    const query = prepareTaskResolutionQuery(targetTask, topTask, keyFilesAndCommits);
    const response = await queryLlmWithTools([{role: 'system', content: systemPrompt}, {role: 'user', content: query}], tools);
    console.log('Response from LLM:');
    console.log(response);
    // Execute response
    for (const toolCall of response) {
      await coder.routeToolCall(toolCall);
    }
    // Confirm execution & response
    // Commit changes
    await executeCommand(`git add . & git commit -m  "${targetTask.title}\n\n${targetTask.description}"`, repoName);
    // Attach commit hash to task
    targetTask.commitHash = await executeCommand('git rev-parse HEAD', repoName);
    return;
  };
  const recursivelyResolveTasks = async (task) => {
    if (task.subtasks.length == 0) {
      // Base case: task is a leaf task
      await resolveTask(task);
      task.title = '~' + task.title + '~';
      // Refresh keyFilesAndCommits
      return;
    }

    for (const subtask of task.subtasks) {
      await recursivelyResolveTasks(subtask);
    }
    task.title = '~' + task.title + '~';
    return;
  };
  
  // Start the resolution process from the root task
  await recursivelyResolveTasks(topTask);
}

class Coder {
  constructor(repoName) {
    this.repoName = repoName;
  }
  
  async createFile(path, contents) {
    await executeCommand(`echo "${contents}" > ${path}`, this.repoName);
  }

  async deleteFile(path) {
    await executeCommand(`rm ${path}`, this.repoName);
  }

  async insertCode(path, location, code) {
    // Create a container
    const container = await createContainer(this.repoName);

    // Echo the code to a temp file in the container
    await executeCommand(`echo "${code}" > temp`, this.repoName, container);
    
    // Insert the code into the specified file using the /usr/bin/insertCode.js script
    await executeCommand(`/usr/bin/insertCode.js ${path} ${location.line} ${location.column} temp`, this.repoName, container);
    
    // Destroy the container
    await destroyContainer(container);
  }

  async replaceCode(path, location, code) {
    // Create a container
    const container = await createContainer(this.repoName);

    // Echo the code to a temp file in the container
    await executeCommand(`echo "${code}" > temp`, this.repoName, container);
    
    // Insert the code into the specified file using the /usr/bin/insertCode.js script
    await executeCommand(`/usr/bin/replaceCode.js ${path} ${location.line} ${location.column} ${location.length} temp`, this.repoName, container);
    
    // Destroy the container
    await destroyContainer(container);
  }


  async deleteCode(path, location) {
    await executeCommand(`/usr/bin/deleteCode.js ${path} ${location.line} ${location.column} ${location.length}`, this.repoName);
  }


  async executeCommand(command) {
    await executeCommand(command, this.repoName);
  }

  async lint(file) {
    await executeCommand(`eslint ${file}`, this.repoName);
  }

  async runTests(file) {
    await executeCommand(`jest ${file}`, this.repoName);
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
          name: 'insertCode',
          description: 'Inserts the provided code at the specified location in the file. Useful for adding new code to existing files.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to modify. Paths must be relative to the root of the repository.'
              },
              location: {
                type: 'object',
                properties: {
                  line: {
                    type: 'number',
                    description: 'The line number to insert the code at.'
                  },
                  column: {
                    type: 'number',
                    description: 'The column number to insert the code at.'
                  }
                },
                required: ['line', 'column']
              },
              code: {
                type: 'string',
                description: 'The code to insert.'
              }
            },
            required: ['path', 'location', 'code']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'replaceCode',
          description: 'Replaces the code at the specified location in the file with the provided code. Useful for modifying existing code.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to modify. Paths must be relative to the root of the repository.'
              },
              location: {
                type: 'object',
                properties: {
                  line: {
                    type: 'number',
                    description: 'The line number to replace the code at.'
                  },
                  column: {
                    type: 'number',
                    description: 'The column number to replace the code at.'
                  },
                  length: {
                    type: 'number',
                    description: 'The number of lines to replace.'
                  }
                },
                required: ['line', 'column', 'length']
              },
              code: {
                type: 'string',
                description: 'The code to insert.'
              }
            },
            required: ['path', 'location', 'code']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteCode',
          description: 'Deletes the code at the specified location in the file. Useful for removing code that is no longer needed.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to modify. Paths must be relative to the root of the repository.'
              },
              location: {
                type: 'object',
                properties: {
                  line: {
                    type: 'number',
                    description: 'The line number to delete the code at.'
                  },
                  column: {
                    type: 'number',
                    description: 'The column number to delete the code at.'
                  },
                  length: {
                    type: 'number',
                    description: 'The number of lines to delete.'
                  }
                },
                required: ['line', 'column', 'length']
              }
            },
            required: ['path', 'location']
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
      }
    ];
  }

  async routeToolCall(toolCall) {
    return await this[toolCall.function](...Object.values(toolCall.arguments));
  }
}

function getSystemPrompt() {
  return `You are a JavaScript coding assistant, specialized in automating the development process by executing specific tool commands. Your main responsibility is to assess JavaScript coding tasks and determine the most efficient way to resolve them using the available set of tools. These tools include creating, deleting, and modifying files, as well as executing commands in the terminal.

  When presented with a task, your first step is to analyze it thoroughly, understanding the requirements and nuances of the task. Based on this analysis, you will then select one or more of the available tools that best suit the task's needs. The tools at your disposal are:
  
  1. \`createFile\`: For creating new files with specified contents.
  2. \`deleteFile\`: For deleting files that are no longer needed.
  3. \`insertCode\`: For adding new code to specific locations in existing files.
  4. \`replaceCode\`: For modifying existing code at specified locations.
  5. \`deleteCode\`: For removing code from specific locations in files.
  6. \`executeCommand\`: For running terminal commands such as npm install or npm start.
  
  Your output should be a series of commands for these tools that will collectively resolve the task. Each command must be specific and detailed, clearly stating the action to be taken, the target file (if applicable), and the exact code or command to be executed. The goal is to fully resolve the task through these commands, ensuring that they are practical, efficient, and aligned with JavaScript best practices.
  
  Remember, your role is to bridge the gap between a high-level task description and the low-level actions required to complete it, thereby streamlining the coding process and enhancing productivity.
  
  You must respond with at least one tool command, but you may return multiple commands if you deem it necessary. DO NOT leave important context in your response content. Any content in your response will be ignored.`;
}

module.exports = { resolveTasks };