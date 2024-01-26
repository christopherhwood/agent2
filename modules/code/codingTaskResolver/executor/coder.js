const { createContainer, destroyContainer, executeCommand } = require('../../../../dockerOperations.js');
const { getRepoContext, selectKeyFiles } = require('../../../summary/codePicker.js');
const Analyzer = require('../analyzer');

class Coder {
  constructor(originalGoal, repoName) {
    this.originalGoal = originalGoal;
    this.repoName = repoName;
    this.fileContext = new Set();
  }

  async getRepoContext() {
    return await getRepoContext(this.repoName);
  }

  async selectKeyFiles(task) {
    const context = await this.getRepoContext();
    const llmPickedKeyFiles = await selectKeyFiles(task, context);
    return [...new Set([...llmPickedKeyFiles.files, ...this.fileContext])];
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
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir.length > 0) {
      await executeCommand(`mkdir -p ${dir}`, this.repoName);
    }
    await executeCommand(`cat << 'EOF' > ${path}\n${contents}\nEOF`, this.repoName);

    // Analyze contents and return suggested edits
    const { errors } = await Analyzer.analyzeNewCode(contents, path, this.repoName);

    let message = `Created ${path} with contents:\n${contents}.`;
    if (errors.length > 0) {
      message += ' Please notice & fix any errors or warnings listed below.';
      message += '\n\n## Errors:\n';
      for (const error of errors) {
        message += `  - Message: ${error.message}\n`;
        message += `  - Details: ${JSON.stringify(error)}\n`;
      } 
    }
    if (this.integrationExperts) {
      const integrationErrors = [];
      for (const integrationExpert of this.integrationExperts) {
        try {
          const integrated = await integrationExpert.searchForIntegration(contents);
          if (integrated) {
            const errors = await integrationExpert.getIntegrationErrors(contents);
            if (errors) {
              integrationErrors.push(...errors);
            }
          }
        } catch (err) {
          console.error('Failed to get integration errors', err);
        }
      }
      
      if (integrationErrors.length > 0) {
        message += '\n\n## Integration Errors:\n';
        integrationErrors.forEach((error) => {
          message += `  - ${error}\n`;
        });
      }
    }
    message += '\n\n## Lint:\n';
    message += await this.lint();
    return message;
  }

  async deleteFile(path) {
    await executeCommand(`rm ${path}`, this.repoName);
    return `Deleted ${path}`;
  }

  async editCode(path, originalCode, newCode, uniqueId) {
    // Replace line breaks in original code with \n
    originalCode = originalCode.replace(/\\n/g, '\n');
    // Replace line breaks in new code with \n
    newCode = newCode.replace(/\\n/g, '\n');

    // Create a container
    const container = await createContainer(this.repoName);

    // Echo the code to a temp file in the container
    await executeCommand(`cat << 'EOF' > /usr/src/temp-${uniqueId}\n${newCode}\nEOF`, this.repoName, container);

    await executeCommand(`cat << 'EOF' > /usr/src/original-${uniqueId}\n${originalCode}\nEOF`, this.repoName, container);
    
    // Insert the code into the specified file using the /usr/bin/insertCode.js script
    let output = await executeCommand(`/usr/bin/replaceCode.js ${path} /usr/src/original-${uniqueId} /usr/src/temp-${uniqueId}`, this.repoName, container);
    
    // Destroy the container
    const fileContents = await executeCommand(`cat ${path}`, this.repoName);
    try {
      if (output && output.length > 0) {
        if (output.includes('Error:')) {
          output = '# Error\n' + output;
          output += `\n\n**Original File Contents at ${path}:**\n\`\`\`\n` + fileContents + '\n```'; 
          if (originalCode.includes('//') || originalCode.includes('/*')) {
            output += '\n\n**IMPORTANT**: The code you provided to be replaced did not match. The snippet contains comments. Please make sure the comments match _exactly_ what is in the source file. Otherwise, the command will fail.';
          }
          return output;
        }
      } else {
        output = '# Success\nThe file\'s contents are:';
        output += `\n\`\`\`\n${fileContents}\n\`\`\``;
      }
    } finally {
      await destroyContainer(container);
    }

    // Analyze contents and return suggested edits
    const { errors } = await Analyzer.analyzeNewCode(newCode, path, this.repoName);

    if (errors.length > 0) {
      output += '\n\nPlease notice & fix any errors or warnings listed below.';
      output += '\n\n## Errors:\n';
      for (const error of errors) {
        output += `  - Message: ${error.message}\n`;
        output += `  - Details: ${JSON.stringify(error)}\n`;
      }
    }

    if (this.integrationExperts) {
      const integrationErrors = [];
      for (const integrationExpert of this.integrationExperts) {
        try {
          const integrated = await integrationExpert.searchForIntegration(fileContents);
          if (integrated) {
            const errors = await integrationExpert.getIntegrationErrors(fileContents);
            if (errors) {
              console.log('Integration errors to merge: ', errors);
              integrationErrors.push(...errors);
            }
          }
        } catch (err) {
          console.error('Failed to get integration errors', err);
        }
      }
      
      if (integrationErrors.length > 0) {
        output += '\n\n## Integration Errors:\n';
        integrationErrors.forEach((error) => {
          output += `  - ${error}\n`;
        });
      }
    }
    output += '\n\n## Lint:\n';
    output += await this.lint();
    return output;
  }

  async executeCommand(command) {
    return await executeCommand(command, this.repoName);
  }

  async installDependencies() {
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
                description: 'The code snippet to replace. This can be the entire contents of an existing file or only the parts of the existing file that you want to replace.\n**IMPORTANT**: The original code must match _exactly_ the code in the file, otherwise the command will fail.\nDo NOT use comments like "// rest of code here". Unless the comment exists in the original code that will NOT match and the command will fail.'
              },
              newCode: {
                type: 'string',
                description: 'The new code snippet to write to the file. This will replace the originalCode.\n**IMPORTANT**: This code will be directly copied as written so do NOT include comments like "// rest of code here" unless you want that comment to be included in the file.'
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
    return await this[toolCall.function](...Object.values(toolCall.arguments), toolCall.id);
  }
}

module.exports = Coder;