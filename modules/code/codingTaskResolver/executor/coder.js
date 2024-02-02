const { executeCommand } = require('../../../../dockerOperations.js');
const { cleanUpCode } = require('./cleanUpCode');

const { queryLlmWTools, queryLlm } = require('../../../../llmService.js');
const { addFile } = require('./addFile');
const { editCode } = require('./editCode');


class Coder {
  constructor(task, spec, repoName) {
    this.task = task;
    this.spec = spec;
    this.repoName = repoName;
  }

  async hasChanges() {
    const diff = await this.gitDiff();
    return diff.length > 0;
  }

  async resolveTask() {
    const messages = await queryLlmWTools([{role: 'system', content: SystemPrompt(this.task, this.spec)}, {role: 'user', content: 'Select a tool to get started.'}], this.getTools(), this, true);

    if (this.hasChanges()) {
      const commitMessage = await queryLlm([{role: 'system', content: `You are a tech lead software engineer overseeing the completion of the following task and tech spec:\n**Task:**\n\`\`\`json\n${JSON.stringify(this.task)}\n\`\`\`\n\n**Spec:**\n\`\`\`markdown\n${this.spec}\`\`\``}, ...messages.splice(1), {role: 'tool', tool_call_id: messages[messages.length-1].tool_calls[0].id, name: 'pass', content: 'Please give a commit message for the changes you made. Use markdown to describe the changes in detail.'}]);
      this.commitChanges(commitMessage);
    }
  }

  async commitChanges(message) {
    // Commit the changes to git  
    await executeCommand(`git add . && git commit -m  "${message}"`, this.repoName);
  }
  
  async createFile(path, spec) {
    await addFile(path, spec, this.repoName);
    await cleanUpCode(path, this.repoName);

    const contents = await executeCommand(`cat ${path}`, this.repoName);
    return `**${path}:**\n\`\`\`\n${contents}\n\`\`\``;
  }

  async deleteFile(path) {
    await executeCommand(`rm ${path}`, this.repoName);
    return `Deleted ${path}`;
  }

  async editCode(path, spec) {
    await editCode(path, spec, this.repoName);
    await cleanUpCode(path, this.repoName);

    const contents = await executeCommand(`cat ${path}`, this.repoName);
    return `**${path}:**\n\`\`\`\n${contents}\n\`\`\``;
  }

  async executeCommand(command) {
    return await executeCommand(command, this.repoName);
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
          description: 'Creates a new file based on the provided spec. Useful for creating new files for functions or logic that does not belong in existing files.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to create. Paths must be relative to the root of the repository.'
              },
              spec: {
                type: 'string',
                description: 'A focused spec for this edit. This should be in markdown format and provide all of the details necessary for the editor to carry out the edit as intended. Make the best attempt to be overly detailed, but don\'t speculate or guess about the code. If unsure, indicate that in the spec and provide optionality for the editor to adjust based on the state of the code.'
              }
            },
            required: ['path', 'spec']
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
          description: 'Edits the file at the provided path based on the provided spec. Useful for replacing an existing code snippet with a new code snippet.',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The relative path to the file to modify. Paths must be relative to the root of the repository.'
              },
              spec: {
                type: 'string',
                description: 'A focused spec for this edit. This should be in markdown format and provide all of the details necessary for the editor to carry out the edit as intended. Make the best attempt to be overly detailed, but try to keep instructions at a high level so that the editor has room to make judgement calls based on the existing code. If unsure about how to carry out the intended edit, indicate that in the spec and provide optionality for the editor to adjust based on the state of the code.'
              },
            },
            required: ['path', 'spec']
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
          name: 'runTests',
          description: 'Runs the test suite for the repository. Useful for ensuring that the code changes did not break any existing functionality.',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pass',
          description: 'This ends work on the current task & spec. Use this only once all work is complete and the task is ready for review. This will trigger the next task in the queue.',
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

const SystemPrompt = (task, spec) => `You are a tech lead software engineer tasked with overseeing the completion of a specific project task, guided by a detailed spec that you have previously prepared. Your role involves coordinating the efforts of your team to implement changes in a Git repository, starting from a clean slate and culminating in a new commit that encapsulates all the modifications made by your team. Your leadership and technical expertise are crucial in guiding the project to a successful completion.

To accomplish this task, you have the following tools at your disposal:
- \`editCode(path, spec)\`: Modify existing code at the specified path, based on a focused spec.
- \`addFile(path, spec)\`: Create a new file at the specified path, with content defined by a detailed spec.
- \`deleteFile(path)\`: Remove the file at the specified path from the repository.
- \`executeCommand(command)\`: Run a specific command in the terminal, such as building the project or deploying to a staging environment.
- \`runTests()\`: Execute the project's test suite to ensure code changes haven't introduced regressions.
- \`pass()\`: Mark the task as complete and ready for review, committing all changes to the repository.

As you analyze the spec and task, your responsibility is to create highly detailed specs for code changes that need to be carried out by your team. These specs should provide clear, high-level guidance without delving into the specifics of implementation. This approach ensures that your team has the necessary direction to make the intended changes while retaining the flexibility to adapt to the existing codebase.

Your leadership involves not only directing the technical aspects of the task but also managing the commit history to ensure it remains clean and focused solely on the task at hand. This means avoiding the temptation to include unrelated cleanup work or minor changes that are not directly relevant to the project goal.

Upon fulfilling the task and spec, and after thorough verification that the code is ready for review, you should:
- Use the \`pass()\` tool to commit the changes. This action signifies your confidence that the code is polished and aligns with the project's standards.

In summary, your role as a tech lead is to provide clear, detailed guidance, coordinate the implementation efforts, ensure the quality of the code through testing, and maintain a clean and focused commit history. Your expertise and oversight are key to the successful and efficient completion of the project task.

**Task:**
\`\`\`json
${JSON.stringify(task)}
\`\`\`

**Spec:**
\`\`\`markdown
${spec}
\`\`\``;

module.exports = Coder;