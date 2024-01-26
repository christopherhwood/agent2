const { Container } = require('../../../../dockerOperations');

class Analyzer {

  static async Create(repoName) {
    const container = await Container.Create(repoName);
    return new Analyzer(repoName, container);
  }

  constructor(repoName, container) {
    this.repoName = repoName;
    this.container = container;
    this.issues = [];
  }

  async readFile(filePath) {
    const fileContents = await this.container.executeCommand(`cat ${filePath}`);
    return fileContents;
  }

  async grep(pattern) {
    const escapeAndQuotePattern = (pattern) => {
      // Escape single quotes by replacing them with '\''
      const escapedPattern = pattern.replace(/'/g, '\\\'');
    
      // Wrap the escaped pattern in single quotes
      return `'${escapedPattern}'`;
    };

    const grepResult = await this.container.executeCommand(`git ls-files | xargs grep ${escapeAndQuotePattern(pattern)}`);
    return grepResult;
  }

  async fileIssue(issue) {
    this.issues.push(issue);
    return 'Successfully filed issue.';
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
          description: 'Reads the contents of a file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path of the file to read.'
              }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'grep',
          description: 'Searches for a pattern in the repository.',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'The pattern to search for.'
              }
            },
            required: ['pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'fileIssue',
          description: 'Files an issue on the repository.',
          parameters: {
            type: 'object',
            properties: {
              issue: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'The title of the issue.'
                  },
                  body: {
                    type: 'string',
                    description: 'The body of the issue.'
                  }
                },
                required: ['title', 'body']
              }
            },
            required: ['issue']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pass',
          description: 'Passes the task without taking any action.',
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

module.exports = Analyzer;