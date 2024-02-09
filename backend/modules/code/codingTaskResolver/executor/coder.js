const { Container, executeCommand } = require('../../../../dockerOperations');

const { queryLlmWTools, queryLlm } = require('../../../../llmService');
const { addFile } = require('./addFile');
const { editCode } = require('./editCode');


class Coder {
  constructor(task, spec, styleGuide, repoName) {
    this.task = task;
    this.spec = spec;
    this.repoName = repoName;
    this.styleGuide = styleGuide;
  }

  async hasChanges() {
    const diff = await this.gitDiff();
    return diff.length > 0;
  }

  async resolveTask() {
    const packageJson = await executeCommand('cat backend/package.json', this.repoName);
    const messages = await queryLlmWTools([{role: 'system', content: SystemPrompt(this.task, this.spec, packageJson)}, {role: 'user', content: 'Select a tool to get started.'}], this.getTools(), this, true);
    
    return await this.checkChangesAndMaybeApprove(messages);
  }

  async checkChangesAndMaybeApprove(messages) {
    if (this.hasChanges()) {
      // get the id of the last message tool call
      const lastMessage = messages[messages.length - 1];
      const lastToolCallId = lastMessage.tool_calls[0].id;

      const commitMessage = await queryLlm([{role: 'system', content: `You are a tech lead software engineer overseeing the completion of the following task and tech spec:\n**Task:**\n\`\`\`json\n${JSON.stringify(this.task)}\n\`\`\`\n\n**Spec:**\n\`\`\`markdown\n${this.spec}\`\`\``}, ...messages.splice(1), {role: 'tool', tool_call_id: lastToolCallId, name: 'pass', content: 'Please give a commit message for the changes you made. You may use markdown to describe the changes, but keep the message concise and useful. Just write straight markdown, no need to wrap it in backticks.'}]);
      this.commitChanges(commitMessage);
    }
  }

  async commitChanges(message) {
    // Create a container
    const container = await Container.Create(this.repoName);

    // Echo the code to a temp file in the container
    await container.executeCommand(`cat << 'EOF' > /usr/src/temp-commit\n${message}\nEOF`);

    // Commit the changes to git  
    await container.executeCommand('git add . && git commit -F  "/usr/src/temp-commit"');
    await container.destroy();
  }
  
  async createFile(path, spec) {
    await addFile(path, spec.minimal, this.styleGuide, this.repoName);

    const contents = await executeCommand(`cat ${path}`, this.repoName);
    const lint = await executeCommand('cd ./backend && npm run lint -- .', this.repoName);
    return `**Contents of ${path}:**\n\`\`\`\n${contents}\n\`\`\`\n**Linting Output:**\n\`\`\`\n${lint}\n\`\`\``;
  }

  async deleteFile(path) {
    const getGrepPatternForFilePath = (filePath) => {
      const pathParts = filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      let patterns = [`'${fileName}'\\'')'`];
      if (fileName.endsWith('index.js')) {
        patterns = [`'${pathParts[pathParts.length - 2]}/index.js'\\'')'`];
        const directoryName = pathParts[pathParts.length - 2];
        patterns.push(`'${directoryName}'\\'')'`);
      } else {
        if (fileName.endsWith('.js')) {
          const fileNameWithoutExtension = fileName.substring(0, fileName.length - 3);
          patterns.push(`'${fileNameWithoutExtension}'\\'')'`);
        } else {
          const indexFileName = fileName + 'index.js';
          patterns.push(`${indexFileName}'\\'')'`);
          const indexFileNameWithoutExtension = fileName + 'index';
          patterns.push(`'${indexFileNameWithoutExtension}'\\'')'`);
        }
      } 
      return patterns;
    };
    const includeResults = await executeCommand(`git ls-files | xargs grep -e ${getGrepPatternForFilePath(path).join(' -e ')}`, this.repoName);
    if (includeResults.trim().length > 0) {
      return `Error: File not deleted - it is included in the following files:\n\`\`\`\n${includeResults}\n\`\`\`. If you want to delete the file you must remove the references to it first.`;
    }
    await executeCommand(`rm ${path}`, this.repoName);
    return `Deleted ${path}`;
  }

  async editCode(path, spec) {
    const message = await editCode(path, spec.minimal, this.styleGuide, this.repoName);

    const contents = await executeCommand(`cat ${path}`, this.repoName);
    const lint = await executeCommand('cd ./backend && npm run lint -- .', this.repoName);
    return `${message}\n\n**Linting Output:**\n\`\`\`\n${lint}\n\`\`\`\n**Contents of ${path} after editing:**\n\`\`\`\n${contents}\n\`\`\``;
  }

  async executeCommand(command) {
    return await executeCommand(command, this.repoName);
  }

  async runTests() {
    return await executeCommand('cd ./backend && npm run test', this.repoName);
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
                type: 'object',
                properties: {
                  veryMinimal: { type: 'string' },
                  minimal: { type: 'string' },
                  detailed: { type: 'string' },
                  veryDetailed: { type: 'string' }
                },
                required: ['veryMinimal', 'minimal', 'detailed', 'veryDetailed'], 
                description: 'A focused spec for the code to add to the new file. This should be in markdown format and provide instructions for your teammate who will carry out the new file creation. As you have not seen the code yet, avoid making specific code suggestions. Be especially careful about assuming the properties of objects unless you know the properties for sure. In the case of adding validations, it\'s better to add less and be correct than to add more and be incorrect. If unsure about how to carry out the intended edit, indicate that in the spec and provide optionality for the editor to adjust based on the state of the code.'
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
                type: 'object',
                properties: {
                  veryMinimal: { type: 'string' },
                  minimal: { type: 'string' },
                  detailed: { type: 'string' },
                  veryDetailed: { type: 'string' }
                },
                required: ['veryMinimal', 'minimal', 'detailed', 'veryDetailed'],
                description: 'A focused spec for this edit. This should be in markdown format (don\'t wrap in backticks though) and provide instructions for your teammate who will carry out the edit. Make the instructions clear and avoid vague terminology like \'make it better\'. As you have not seen the code yet, avoid making specific code suggestions. Be especially careful about assuming the properties of objects unless you know the properties for sure. In the case of adding validations, it\'s better to add less and be correct than to add more and be incorrect.'
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

const SystemPrompt = (task, spec, packageJson) => `You are a tech lead software engineer tasked with overseeing the completion of a specific project task, guided by a detailed spec that you have previously prepared. Your role involves coordinating the efforts of your team to implement changes in a Git repository, starting from a clean slate and culminating in a new commit that encapsulates all the modifications made by your team. Your leadership and technical expertise are crucial in guiding the project to a successful completion.

Be aware that the task you receive was written before the project started. It is possible that you and your team have already accomplished the task. So you should always double check the code first before issuing any instructions.

When writing tests, if you encounter missing environment variables try mocking them out.

To accomplish this task, you have the following tools at your disposal:
- \`editCode(path, spec)\`: Modify existing code at the specified path, based on a focused spec.
- \`addFile(path, spec)\`: Create a new file at the specified path, with content defined by a detailed spec.
- \`deleteFile(path)\`: Remove the file at the specified path from the repository.
- \`executeCommand(command)\`: Run a specific command in the terminal, such as building the project or deploying to a staging environment.
- \`runTests()\`: Execute the project's test suite to ensure code changes haven't introduced regressions.
- \`pass()\`: Mark the task as complete and ready for review, committing all changes to the repository.

After you take one of the actions below, you will receive a response. The response may include warnings, errors, or lint results. Don't ignore these. Warnings may not require any action, but lint errors and other errors must be addressed.

As you analyze the spec and task below, your responsibility is to create specs for code changes that need to be carried out by your team. These specs should provide clear, high-level guidance without delving into the specifics of implementation. 

**IMPORTANT**: Do NOT include code snippets in your spec. This approach ensures that your team has the necessary direction to make the intended changes while retaining the flexibility to adapt to the existing codebase.

If you determine that the task has already been completed then you should just pass the task.

** VERY IMPORTANT:** Do NOT make assumptions when writing specs. Do NOT assume the existence of modules, frameworks, files, or properties on objects (not even id)! You have access to the command line and should be able to verify any assumptions or questions you have (for example, use grep, cat, etc). It's important that you not be lazy issuing instructions and to not make mistakes including relying on assumptions or guesses.

Do NOT include complex logging or error handling in your specs. Follow the existing logging and error handling patterns in the code, unless the task explicitly says to do otherwise. Limit the complexity of logging and error handling and do NOT introduce new frameworks for this unless explicitly asked to do so. Remember to focus on the task at hand and avoid scope creep.

You are responsible for conducting code review on your team's edits. Don't judge the business aspects of the code, but make sure there are no bugs. If you see fishy looking property accesses or suspect a function's arguments or return type are not correct, then use the tools at your disposal to investigate and prompt your team to make corrective edits if necessary. DO NOT commit buggy code.

Your leadership involves not only directing the technical aspects of the task but also managing the commit history to ensure it remains clean and focused solely on the task at hand. This means avoiding the temptation to include unrelated cleanup work or minor changes that are not directly relevant to the project goal.

Upon fulfilling the task and spec, and after thorough verification that the code is ready for review, you should:
- Use the \`pass()\` tool to commit the changes. This action signifies your confidence that the code is polished and aligns with the project's standards.

In summary, your role as a tech lead is to provide clear, detailed guidance, coordinate the implementation efforts, ensure the quality of the code through testing, and maintain a clean and focused commit history. Your expertise and oversight are key to the successful and efficient completion of the project task.

Try to avoid adding new dependencies unless absolutely necessary. Here is the package.json so that you can see what is already included in the project:
\`\`\`json
${JSON.stringify(packageJson)}
\`\`\`

**Your Task:**
\`\`\`json
${JSON.stringify(task)}
\`\`\`

**Task Engineering Spec:**
\`\`\`markdown
${spec}
\`\`\``;

module.exports = Coder;
