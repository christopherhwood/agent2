const { createContainer, destroyContainer, executeCommand } = require('../../dockerOperations.js');

class Coder {
  constructor(repoName, rootTask) {
    this.repoName = repoName;
    this.rootTask = rootTask;
  }

  async commitChanges(task) {
    const container = await createContainer(this.repoName);

    // Commit the changes to git  
    await executeCommand(`git add . && git commit -m  "${task.title}\n\n${task.description}"`, this.repoName, container);

    // Add commit hash to the task
    task.commitHash = await executeCommand('git rev-parse HEAD', this.repoName, container);

    await destroyContainer(container);
  }
  
  async createFile(path, contents) {
    // mkdir for all paths but make sure to exclude filename
    await executeCommand(`mkdir -p ${path.substring(0, path.lastIndexOf('/'))} && echo "${contents}" > ${path}`, this.repoName);
  }

  async deleteFile(path) {
    await executeCommand(`rm ${path}`, this.repoName);
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
    return await executeCommand(command, this.repoName);
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
          description: 'Replaces the original code snippet with the new code snippet at the provided path. Useful for modifying existing code. The new code snippet will completely overwrite the original snippet so it should be complete and ready for use.',
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

module.exports = Coder;