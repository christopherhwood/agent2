const { queryLlmWithJsonCheck } = require('../../../../llmService');

async function generateSpec(task, problemStatement) {
  const res = await queryLlmWithJsonCheck([{role: 'system', content: SystemPrompt}, {role: 'user', content: query(task, problemStatement)}], validateSpec);
  return res;
}

const validateSpec = (response) => {
  if (!response || !response.filesToChange || !response.filesToAdd || !response.filesToDelete) {
    throw new Error('Response must be an object with filesToChange, filesToAdd, and filesToDelete properties');
  }
  if (!Array.isArray(response.filesToChange)) {
    response.filesToChange = [];
  }
  if (!Array.isArray(response.filesToAdd)) {
    response.filesToAdd = [];
  }
  if (!Array.isArray(response.filesToDelete)) {
    response.filesToDelete = [];
  }
  return response;
};

const query = (task, problemStatement) => {
  let query = `#${task.title}\n`;
  query += `**Description:** ${task.description}\n`;
  query += `**Coding Work:** ${task.codingWork}\n\n`;
  query += '## Selected Context\n\n';
  for (const context of task.selectedContext) {
    query += `**${context.file}**\n\n`;
    query += '```javascript\n';
    query += `${context.contents}\n`;
    query += '```\n\n';
  }
  query += '## Problem Statement\n\n';
  query += '```markdown\n';
  query += `${problemStatement}\n`;
  query += '```';
  return query;
};

const SystemPrompt = `You are a senior software engineer working on a programming task. You will be provided a task (with a title, description, and coding work), some selected related code snippets from the codebase, and the problem statement of what we're trying to do.

Your job is to output an engineering spec to resolve this task. Discuss how data will flow, what interfaces look like, and what the new code will do. Be extremely specific on not only the structure of data but also how they are acquired and what kind of data is in there. It is not sufficient to say that something is an object for example. Every piece of data should have an origin, handwavy data just appearing mid spec is not acceptable.

Justify suggestions to delete, add, or change files. Don't expect the junior engineers to be able to guess your intent. More details here are critical to see your plan carried out correctly. When in doubt, add more detail.

Use json for your spec. The json must include the following fields: {filesToChange: [''], filesToAdd: [''], filesToDelete: ['']} where filesToChange is a list of files that will be impacted by the coding changes in the spec, filesToAdd and filesToDelete are self-explanatory. You may write the rest of the json spec however you see fit.

Be wary when suggesting to change or delete functions that are currently in use. If you change the function signature, you will need to update all calls to that function. If you change the function body, you will need to ensure that the new code does not break any existing functionality. If you delete a function you will need to ensure all of its call locations are removed from the codebase. It may be easier sometimes to create a new function that accomplishes your goals rather than trying to change an existing function. However, bare in mind that this will increase the amount of code in the codebase and the maintenance burden.

Below is an example of spec generation.

## Input
\`\`\`markdown
**Task:** Develop a new module within the agent2 repository dedicated to generating commit messages. This module will be responsible for interfacing with other parts of the system and managing the generation process.
**Coding Work:** Write code to define the module structure, including functions for initiating the message generation process and handling inputs from the Coder class.

## Selected Context

**./modules/code/codingTaskResolver/executor/coder.js**
\\\`\\\`\\\`
class Coder {
// ...
async commitChanges(task) {
    const container = await createContainer(this.repoName);

    // Commit the changes to git  
    await executeCommand(\\\`git add . && git commit -m  "\${task.title}\n\n\${task.description}"\\\`, this.repoName, container);

    // Add commit hash to the task
    task.commitHash = await executeCommand('git rev-parse HEAD', this.repoName, container);

    await destroyContainer(container);
  }
  // ...
\\\`\\\`\\\`

**./commitMessageGenerator.js**
\\\`\\\`\\\`
function generateCommitMessage(taskDetails, codeChanges) {
  // Logic to format the commit message based on taskDetails and codeChanges
  const commitMessage = \\\`\${taskDetails}: \${codeChanges}\\\`;
  return commitMessage;
}

module.exports = { generateCommitMessage };
\\\`\\\`\\\`

**ProblemStatement.md**
\\\`\\\`\\\`
## Current State of the Repository
The \\\`agent2\\\` repository, designed to automate software development workflows, currently employs a basic mechanism for generating commit messages. The existence of \\\`commitMessageGenerator.js\\\` is noted, but it lacks integration in the main application workflow. The primary handling of commit operations is within the \\\`Coder\\\` class, specifically in the \\\`commitChanges\\\` method located at \\\`./modules/code/codingTaskResolver/executor/coder.js\\\`. This method creates commit messages by simply concatenating a task's title and description. This rudimentary approach does not provide the necessary depth, context, or detail for effective documentation and traceability within the repository.
\\\`\\\`\\\`
\`\`\`

## Output
\`\`\`json
{
  "filesToChange": ["./modules/code/codingTaskResolver/executor/coder.js"],
  "filesToAdd": ["./modules/code/commitMessageModule/index.js"],
  "filesToDelete": ["./commitMessageGenerator.js"],
  "module": {
    "name": "CommitMessageModule",
    "location": "./modules/code/commitMessageModule",
    "description": "Handles generation of detailed commit messages.",
    "functions": {
      "generateCommitMessage": {
        "description": "Generates a detailed commit message based on task details and code changes.",
        "inputs": {
          "taskDetails": {
            "type": "object",
            "source": "Passed as an argument from Coder class's commitChanges method.",
            "structure": {
              "title": "string",
              "description": "string",
              "commitHash": "string (optional, added after commit)"
            }
          },
          "codeChanges": {
            "type": "string",
            "source": "Generated or retrieved within Coder class, representing a summary or diff of code changes."
          }
        },
        "output": {
          "type": "string",
          "description": "Formatted commit message."
        }
      }
    }
  },
  "coderClassChanges": {
    "filePath": "./modules/code/codingTaskResolver/executor/coder.js",
    "changes": {
      "importCommitMessageModule": {
        "description": "Import the new CommitMessageModule."
      },
      "modifyCommitChangesMethod": {
        "description": "Update to use CommitMessageModule for generating commit messages.",
        "newLogic": {
          "generateCommitMessage": {
            "description": "Call CommitMessageModule.generateCommitMessage with appropriate arguments."
          }
        }
      }
    }
  }
}
\`\`\``;

module.exports = { generateSpec };