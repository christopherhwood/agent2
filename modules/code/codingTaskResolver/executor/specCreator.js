const { queryLlm } = require('../../../../llmService');

async function generateSpec(task, problemStatement) {
  const res = await queryLlm([{role: 'system', content: SystemPrompt}, {role: 'user', content: query(task, problemStatement)}]);
  return res;
}

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

Your job is to output an engineering spec to resolve this task. Discuss how data will flow, what interfaces look like, and what the new code will do. Be extremely specific on not only the structure of data but also how they are acquired and what kind of data is in there. It is not sufficient to say that something is an object for example. Every piece of data should have an origin, handwavy data just appearing mid spec is not acceptable. The only exception is when an object is being passed through and properties on it are not being accessed in the code we're editing.

Justify suggestions to delete, add, or change files. Don't expect the junior engineers to be able to guess your intent. More details here are critical to see your plan carried out correctly. When in doubt, add more detail.

Keep the spec as simple as possible, try to achieve the task with minimal complexity. Interpret and follow the task strictly, don't add any extra functionality that is not required by the task. 

Avoid giving specific code examples. Leave the coding up to the engineers on the project. Just explain in high level terms what the code needs to achieve. Be specific about the requirements and the expected behavior of the code, but don't write the code itself. Make the requirements as focused and minimal as possible to fight scope creep.

Be extremely cautious recommending actions around api endpoints, database queries, or function calls. Any integration point like this should only be altered if absolutely required by the task. And in those cases, do the minimal changes necessary. These parts of the system are the most fragile and the most likely to break.

Use markdown for your spec. Write the spec as you see fit, but it's recommended to call out where new files may need to be added, which files should be considered for editing, and whether there is need for integrations with existing internal code or potentially third-party or open source code. When referencing specific files, use paths relative to the root of the repository.

Be wary when suggesting to change or delete functions that are currently in use. If you change the function signature, you will need to update all calls to that function. If you change the function body, you will need to ensure that the new code does not break any existing functionality. If you delete a function you will need to ensure all of its call locations are removed from the codebase. It may be easier sometimes to create a new function that accomplishes your goals rather than trying to change an existing function. However, bare in mind that this will increase the amount of code in the codebase and the maintenance burden.

In your response, just return straight markdown, no need to wrap your response in backticks.

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
\\\`\\\`\\\`markdown
# Engineering Spec for Commit Message Generation Module

## Overview

This document specifies the development of a new module for generating commit messages within the \`agent2\` repository. The aim is to provide a structured and enhanced approach to commit message creation, leveraging task details and code changes, and to seamlessly integrate with the existing \`Coder\` class.

## Objectives

- Implement a module for detailed and formatted commit message generation.
- Integrate this new module with the \`Coder\` class to improve commit operations.
- Limit modifications to existing APIs, database queries, or function calls to ensure system stability.

## Module Structure and Changes

### New Files

- **\`./modules/commitMessageGenerator/index.js\`**: The main module file with commit message generation logic.
- **\`./modules/commitMessageGenerator/messageFormatter.js\`**: A helper file for commit message formatting.

### Modifications

- **\`./modules/code/codingTaskResolver/executor/coder.js\`**: To integrate the new commit message generation module.
- **\`./commitMessageGenerator.js\`**: To be deprecated or refactored into the new module.

## Data Flow and Interfaces

### Commit Message Generator (\`./modules/commitMessageGenerator/index.js\`)

\\\\\`\\\\\`\\\\\`javascript
const { formatCommitMessage } = require('./messageFormatter');

class CommitMessageGenerator {
  generate(taskDetails, codeChanges) {
    return formatCommitMessage(taskDetails, codeChanges);
  }
}

module.exports = CommitMessageGenerator;
\\\\\`\\\\\`\\\\\`

### Message Formatter (./modules/commitMessageGenerator/messageFormatter.js)

\\\\\`\\\\\`\\\\\`javascript
function formatCommitMessage(taskDetails, codeChanges) {
  const commitMessage = \`Task: \${taskDetails.title}\nDescription: \${taskDetails.description}\nChanges: \${codeChanges}\`;
  return commitMessage;
}

module.exports = { formatCommitMessage };
\\\\\`\\\\\`\\\\\`

### Integration with Coder Class (./modules/code/codingTaskResolver/executor/coder.js)

Integrate the commit message generation logic by replacing the current method with a call to \`CommitMessageGenerator\`.

\\\\\`\\\\\`\\\\\`javascript
const CommitMessageGenerator = require('../../../commitMessageGenerator');

class Coder {
  // ...
  async commitChanges(task) {
    const container = await createContainer(this.repoName);
    const commitMessageGenerator = new CommitMessageGenerator();
    const commitMessage = commitMessageGenerator.generate(task, "Code changes details...");

    await executeCommand(\`git add . && git commit -m "\${commitMessage}"\`, this.repoName, container);

    task.commitHash = await executeCommand('git rev-parse HEAD', this.repoName, container);

    await destroyContainer(container);
  }
  // ...
}
\\\\\`\\\\\`\\\\\`

## Justifications
- **New Module (./modules/commitMessageGenerator)**: Enhances maintainability and reusability by centralizing commit message generation.
- **Integration with Coder Class**: Uses the new module to improve commit message quality without disrupting existing workflows.
- **Minimal Changes**: Ensures stability by limiting changes to critical system integrations.

## Future Considerations

- **Refactor/Deprecate \`./commitMessageGenerator.js\`**: Determine the necessity of this file based on its current usage within the repository.
- **Commit Message Logic Enhancements**: Consider more sophisticated logic for future versions, including automatic context inclusion and integration with external systems.

This specification aims at improving the clarity, maintainability, and effectiveness of commit message generation within the \`agent2\` repository.
\\\`\\\`\\\`
\`\`\``;

module.exports = { generateSpec };