const { executeCommand } = require('../../dockerOperations');
const { queryLlm, queryLlmWTools } = require('../../llmService');

class ProblemTracer {
  constructor(highLevelTask, taskDeepDive, repoSummary, directoryTree, repoName) {
    this.highLevelTask = highLevelTask;
    this.taskDeepDive = taskDeepDive;
    this.repoSummary = repoSummary;
    this.directoryTree = directoryTree;
    this.repoName = repoName;
  }

  async traceProblem() {
    const messages = await queryLlmWTools([{role: 'system', content: systemPrompt(this.highLevelTask, this.taskDeepDive, this.repoSummary, this.directoryTree)}, {role: 'user', content: initialQuery}], this.getTools(), this, true);
    const assistantMessageContents = messages.filter(m => m !== null && m.role === 'assistant' && typeof(m.content) === 'string' && m.content.length > 0).map(m => m.content);
    console.log('assistantMessageContents', assistantMessageContents);
    return await this.createProblemStatement(assistantMessageContents);
  }

  async createProblemStatement(messageContents) {
    return await queryLlm([{role: 'system', content: problemStatementSystemPrompt(this.highLevelTask)}, {role: 'user', content: messageContents.join('\n\n')}]);
  }

  async analyzeFile(filePath) {
    const fileContents = await executeCommand(`cat ${filePath}`, this.repoName);
    const grepResults = await executeCommand(`git ls-files | xargs grep -e ${getGrepPatternForFilePath(filePath).join(' -e ')}`, this.repoName);
    
    let response = query(filePath, fileContents, getGrepPatternForFilePath(filePath), grepResults);
    return response;
  }

  async grep(queryString) {
    const grepResults = await executeCommand(`git ls-files | xargs grep ${queryString}`, this.repoName);
    let response = query(null, null, [queryString], grepResults);
    return response;
  }

  getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'analyzeFile',
          description: 'Returns the file contents and grep results for all imports of that file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'The path to the file to analyze. Must be a path relative to the root of the repository.'
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
          description: 'Returns the grep results for the given query.',
          parameters: {
            type: 'object',
            properties: {
              queryString: {
                type: 'string',
                description: 'The query to grep for.'
              }
            },
            required: ['queryString']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pass',
          description: 'Exits the exploring phase and moves on to the next step of the process.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      }
    ];
  }

  async routeToolCall(toolCall) {
    return await this[toolCall.function](...Object.values(toolCall.arguments), toolCall.id);
  }
}

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

const initialQuery = 'To start, either pick one file to start tracing the existing program\'s flow or pick a pattern to grep in the codebase. We will share the results (file contents or grep results) and then you can continue to grep or read files.';

const query = (filePath, fileContents, grepQueries, grepResults) => {
  let query = '';
  if (filePath && fileContents) {
    query += `Here is the \`${filePath}\` file contents:\n\`\`\`\n${fileContents}\n\`\`\`\n\n`;
    if (grepQueries && grepResults) {
      query += 'Grep results for ';
      const queryString = grepQueries.map(query => `\`${query}\``).join(', ');
      query += queryString + '(this should display where the file is imported) are as follows:\n';
      query += `\`\`\`\n${grepResults.split('\n')}\n\`\`\`\n\n`;
    }
  } else {
    query += 'Grep results for ';
    const queryString = grepQueries.map(query => `\`${query}\``).join(', ');
    query += queryString + ' are as follows:\n';
    query += `\`\`\`\n${grepResults.split('\n')}\n\`\`\`\n\n`;
  }
  query += 'Take a moment to share with me in the contents of your message what you have learned from examining the information above and how that impacts your understanding of the task.\n\n';
  query += 'Then, using the functions available to you, either request the next file you\'d like to view or the pattern you\'d like to grep for, and we will continue on gaining background on the task\'s underlying problem.\n\n';
  query += 'If you feel you have enough background information, you can request to move on to the next step of the process.\n\n';
  return query;  
};

const systemPrompt = (highLevelTask, taskDeepDive, repoSummary, directoryTree) => {
  let prompt = `You are a staff software engineer, coming to grips with a new task you've been assigned. Together, you and a few of your colleagues have put together a detailed analysis of the task and a high level summary of the codebase. 

  Now you are exploring the current situation that the task is designed to improve on. Your job is to point out what the current state of the repository is in terms of the given task. Don't concern yourself with trying to solve the task yet. We are only focused on putting together a problem statement.
  
  The goal right now is **NOT** to start solving the task, but to continue gathering information about how things work right now. We don't need to explore how things that might solve the task work yet. Our goal is simply to understand the existing "problem" better.
  
  You have available to you the following functions for exploring the codebase:
    - analyzeFile(filePath): returns the file contents and grep results for all imports of that file.
    - grep(queryString): returns the grep results for the given query.
    - pass(): exits the exploring phase and moves on to the next step of the process.

  You must select one of the above functions on each reply.

  ## Helpful Tips

  Pinpoint the current problem. Make sure you have a clear understanding of how the related part of the code works. Don't dilute your messages by exploring parts of the code that are not directly relevant to understanding the current task. 
  
  Your notes will be used as an input to the implementation plan for the task. An incomplete analysis risks misleading the engineering team and wasting time and resources.

  An example exploration path for a given directory tree is below, with reasons associated with each decision:
  \`\`\`markdown
  # Example Task
  We need to create better commit messages when we finish each task. You can use whatever you need to create the best commit message possible, including using the LLM to generate a commit message based on the work completed for the task, the summary, the task title and description, etc.
  # Example Directory Tree
  .
  |-- app.js
  |-- commitMessageGenerator.js
  |-- dockerOperations.js
  |-- llmService.js
  |-- modules
  |   |-- code
  |   |   |-- codingTaskResolver
  |   |   |   |-- analyzer
  |   |   |   |   |-- analyzeChanges.js
  |   |   |   |   |-- analyzer.js
  |   |   |   |   \`-- issueTaskCreator.js
  |   |   |   |-- executor
  |   |   |   |   |-- coder.js
  |   |   |   |   \`-- executeTask.js
  |   |   |   \`-- index.js
  |   |   |-- index.js
  |   |   \`-- nonCodingTaskResolver
  |   |       |-- index.js
  |   |       \`-- nonCoder.js
  |   |-- plan
  |   |   |-- answer
  |   |   |   |-- answerer.js
  |   |   |   |-- index.js
  |   |   |   \`-- resourceGatherer.js
  |   |   |-- index.js
  |   |   |-- question
  |   |   |   \`-- index.js
  |   |   |-- roughPlanner.js
  |   |   \`-- taskTreeGenerator.js
  |   \`-- summary
  |       |-- analysis
  |       |   |-- dependencyAnalysis.js
  |       |   |-- functionAnalysis.js
  |       |   \`-- index.js
  |       |-- analyzeRepo.js
  |       |-- codePicker.js
  |       |-- index.js
  |       \`-- parser
  |           |-- directoryExplorer.js
  |           |-- gitIgnore.js
  |           |-- index.js
  |           \`-- traverser.js
  |-- package.json
  |-- sandbox
  |   \`-- bin
  |       \`-- replaceCode.js
  |-- sandbox.Dockerfile
  \`-- utils.js
  \`\`\`
  \`\`\`markdown
  # Exploration steps for example directory tree above:
  - Start with commitMessageGenerator.js because it's the only file that has "commit" in the name.
  - Grep for the main function in commitMessageGenerator.js, \`generateCommitMessage\`, to see where it's used. Discover it's not used anywhere.
  - Analyze app.js to understand how the app handles requests. Discover that it uses the code module to resolve tasks.
  - Analyze ./modules/code/index.js to understand how it resolves tasks. Discover that it uses the codingTaskResolver to resolve coding tasks.
  - Analyze ./modules/code/codingTaskResolver/index.js to understand how it resolves coding tasks. Discover that it uses the coder to execute tasks and make commits.
  - Analyze ./modules/code/codingTaskResolver/executor/coder.js to understand how it executes tasks and makes commits. Discover that it uses the \`commitChanges\` method to make commits, and that commits are the task title and description.
  - Pass now that we understand how the current commit message generation works.
  \`\`\``;
  prompt += '\n\n# Task\n' + highLevelTask;
  prompt += '\n\n# Task Deep Dive\n' + taskDeepDive;
  prompt += '\n\n' + repoSummary;
  prompt += '\n\n# Repository Directory Tree\n' + directoryTree;
  return prompt;
};

const problemStatementSystemPrompt = (highLevelTask) => {
  let prompt = `You are a staff software engineer, coming to grips with a new task you've been assigned. Together, you and a few of your colleagues have traced the underlying problem/scenario in the codebase that the task is working to solve.

  You will be sent a list of messages from the problem solving chat, and your job is to review the messages from the problem tracing chat as well as the original high-level task and put together a problem statement. The problem statement should be a concise summary of the problem that the task is designed to solve. It should be written in a way that is easy to understand and can be used to communicate the problem to other engineers. Write the problem statement using markdown.
  
  The goal right now is not to start solving the task, but to continue gathering information about how things work right now. We don't need to explore how things that might solve the task work yet. Our goal is simply to understand the existing "problem" better.

  Here's an example problem statement:
  \`\`\`markdown
# Problem Statement: Enhancing Commit Message Generation in the \`agent2\` Repository

## Current State of the Repository
The \`agent2\` repository, designed to automate software development workflows, currently employs a basic mechanism for generating commit messages. The existence of \`commitMessageGenerator.js\` is noted, but it lacks integration in the main application workflow. The primary handling of commit operations is within the \`Coder\` class, specifically in the \`commitChanges\` method located at \`./modules/code/codingTaskResolver/executor/coder.js\`. This method creates commit messages by simply concatenating a task's title and description. This rudimentary approach does not provide the necessary depth, context, or detail for effective documentation and traceability within the repository.

## High Priority of the Task
Enhancing the commit message generation process is a high-priority task due to:

1. **Improved Documentation and Traceability**: Detailed commit messages are essential for understanding code changes' history and rationale, aiding in code review, debugging, and future enhancements.
2. **Enhanced Team Collaboration**: Descriptive commit messages improve communication within the development team, a critical aspect in an automation-heavy system.
3. **Leveraging Advanced Capabilities**: The potential of \`agent2\` to integrate advanced machine learning models and techniques is not fully realized in the current commit message generation process.

## Ideas for Future Exploration
Future enhancements to the commit message generation process could include:

1. **Contextual Analysis**: Implementing a more detailed analysis of the changes in each commit, considering the scope and impact.
2. **Integration with Language Models**: Using language models to generate more descriptive and nuanced messages that accurately reflect the technical and functional aspects of code changes.
3. **Task and Issue Linkage**: Linking commit messages to specific tasks or issues, providing a clear connection between code changes and project goals.
4. **Semantic Code Analysis**: Employing techniques to understand and describe changes in a technically rich and informative manner.
5. **Automated Summarization**: Using automated summarization to distill key information from code changes and task descriptions into concise, informative commit messages.

Addressing these aspects will significantly enhance the quality and utility of commit messages in the \`agent2\` repository, aligning with its broader goals of automating and streamlining software development tasks.
\`\`\`
 `;   
  prompt += '\n\n# Task\n' + highLevelTask;
  return prompt;
};

module.exports = ProblemTracer;