const { Container } = require('../../../dockerOperations.js');

class NonCoder {
  static async Create(repoName) {
    const container = await Container.Create(repoName);
    return new NonCoder(repoName, container);
  }

  constructor(repoName, container) {
    this.repoName = repoName;
    this.container = container;
    this.fileContext = new Set();
  }

  async readFile(filePath) {
    if (!filePath) {
      throw new Error('Invalid arguments.');
    }
    if (!this.fileContext.has(filePath)) {
      this.fileContext.add(filePath);
    }
    const contents = this.container.executeCommand(`cat ${filePath}`);
    return contents;
  }

  async reviewDiffsInPR() {
    const diffs = this.container.executeCommand('git diff origin/main');
    return diffs;
  }

  async destroy() {
    await this.container.destroy();
  }

  getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'readFile',
          description: 'Reads the contents of the file at the specified path relative to the root of the repository.',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The relative path to the file to read. Paths must be relative to the root of the repository.'
              }
            },
            required: ['filePath']
          },
        }
      },
      {
        type: 'function',
        function: {
          name: 'reviewDiffsInPR',
          description: 'Returns the diffs in the current PR (diffs in this branch not yet pushed to main/master).',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          },
        }
      },
      {
        type: 'function',
        function: {
          name: 'pass',
          description: 'Does nothing. Exits the task.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          },
        }
      }
    ];
  }
  
  async routeToolCall(toolCall) {
    return await this[toolCall.function](...Object.values(toolCall.arguments));
  }
}

module.exports = NonCoder;