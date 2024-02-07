const { executeCommand } = require('../../../../dockerOperations');
const { queryLlm, queryLlmWTools } = require('../../../../llmService');

class StyleGuideAuthor {
  constructor(repoName) {
    this.repoName = repoName;
  }

  async createStyleGuide() {
    const dirTree = await this.viewDirectoryTree();
    const packageJson = await this.viewPackageJson();

    const messages = await queryLlmWTools([{role: 'system', content: ResearchSystemPrompt}, {role: 'user', content: query(this.repoName, dirTree, packageJson)}]);

    const notes = messages.filter(m => m.role === 'assistant' && m.content).map(m => m.content).join('\n\n');

    const styleGuide = queryLlm([{role: 'system', content: WriterSystemPrompt}, {role: 'user', content: `I am providing you with your recent notes on the ${this.repoName} repository. Now you must write the style guide. Best of luck!\n\n# Notes:\n\n${notes}`}]);
    return styleGuide;
  }

  async viewFile(filePath) {
    return await executeCommand(`cat ${filePath}`, this.repoName);
  }

  async viewDirectoryTree() {
    return await executeCommand('tree -I "node_modules|.git|package-lock.json', this.repoName);
  }

  async viewPackageJson() {
    return await executeCommand('cd ./backend && cat package.json', this.repoName);
  }

  getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'viewFile',
          description: 'This function takes a file path (must be a relative path from the root of the directory) and returns the contents of the file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The file path to view (relative to the root of the directory)'
              }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'viewDirectoryTree',
          description: 'This function returns the directory tree of the repository.',
          parameters: {
            type: 'object',
            properties: {},
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'viewPackageJson',
          description: 'This function returns the contents of the package.json file.',
          parameters: {
            type: 'object',
            properties: {},
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pass',
          description: 'This function stops the viewing process early and allows you to create the style guide.',
          parameters: {
            type: 'object',
            properties: {},
          }
        }
      }
    ];
  }

  async routeToolCall(toolCall) {
    return await this[toolCall.function](...Object.values(toolCall.arguments), toolCall.id);
  }
}

const query = (repoName, directoryTree, packageJson) => `Today you are going to write a style guide for the ${repoName} repository. This is a Node.js repository. I am providing you with a directoryTree and the contents of the package.json to start. You have 5 files left that you can view before you must write the style guide. Best of luck!

**Directory Tree:**
\`\`\`
${directoryTree}
\`\`\`

**package.json:**
\`\`\`json
${JSON.stringify(packageJson)}
\`\`\``;

const WriterSystemPrompt = `You are an expert code style guide author. You can look at just a few code examples from a repository and develop a guide for the team to follow.

When you encounter a new repository, you quickly flip through a few files and take notes on the existing style. You always pay attention to the following:
- How are the files organized?
- How are the functions and classes named?
- How are the comments written?
- How are the imports organized?
- How are the tests written?
- How are the dependencies managed?
- How are the error messages written?
- How are the logs written?
- How are the environment variables used?
- How are the constants defined?
- What testing framework is used?
- What 3rd party libraries are used?
- What is overall architecture of the codebase?

You then use this information to create a style guide for the team to follow. You should include examples from the codebase to illustrate your points. You should also include a section on how to write new code in the style of the existing codebase.`;

const ResearchSystemPrompt = `You are an expert code style guide author. You can look at just a few code examples from a repository and develop a guide for the team to follow.

When you encounter a new repository, you quickly flip through a few files and take notes on the existing style. You always pay attention to the following:
- How are the files organized?
- How are the functions and classes named?
- How are the comments written?
- How are the imports organized?
- How are the tests written?
- How are the dependencies managed?
- How are the error messages written?
- How are the logs written?
- How are the environment variables used?
- How are the constants defined?
- What testing framework is used?
- What 3rd party libraries are used?
- What is overall architecture of the codebase?

You then use this information to create a style guide for the team to follow. You should include examples from the codebase to illustrate your points. You should also include a section on how to write new code in the style of the existing codebase.

You have available to you the following tools: 
- viewFile(filePath): This function takes a file path (must be a relative path from the root of the directory) and returns the contents of the file.
- viewDirectoryTree(): This function returns the directory tree of the repository.
- viewPackageJson(): This function returns the contents of the package.json file.
- pass(): This function stops the viewing process early and allows you to create the style guide.

You are limited to viewing 5 files maximum. You can view the same file multiple times if you need to. You can view the directory tree and package.json as many times as you need to. After viewing 7 files, you will be asked to create the style guide.`;

module.exports = StyleGuideAuthor;