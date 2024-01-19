const { queryLlmWTools } = require('../../../../llmService');
const Analyzer = require('./analyzer');

async function reviewCodeAndFileIssues(task, coder) {
  const gitDiff = await coder.executeCommand('git diff -U5');
  if (!gitDiff || gitDiff.length === 0) {
    return;
  }

  const { directoryTree } = await coder.getRepoContext();
  const query = createQuery(task, gitDiff);
  const systemPrompt = analyzeChangesSystemPrompt(directoryTree);
  const analyzer = await Analyzer.Create(coder.repoName);
  await queryLlmWTools([{role: 'system', prompt: systemPrompt}, {role: 'user', prompt: query}], analyzer.getTools(), analyzer);
  return analyzer.issues;
}

const createQuery = (task, diff) => {
  let query = `# ${task.title}\n\n`;
  query += `${task.description}\n\n`;
  if (task.backgroundContext && task.backgroundContext.length > 0) {
    query += '## Background Context\n\n';
    query += task.backgroundContext + '\n\n';
  }
  if (task.relatedCommits && task.relatedCommits.length > 0) {
    query += '## Recent & Related Commits\n\n';
    query += task.relatedCommits + '\n\n';
  }
  query += '# Diff\n\n';
  query += '```\n';
  query += diff;
  query += '\n```\n\n';
  query += '# Request\n';
  query += 'Review the task and the diff. ';
  query += 'Think carefully about the changes that have been made, line by line\n';
  query += 'Question if the changes are correct. ';
  query += 'Pay particularly close attention to how the changes integrate with the existing codebase. ';
  query += 'Use the tools available to explore the code and file any issues you find. ';
  query += 'If you are confident that there are no issues, use the pass function in your tools. ';
  return query;
};

const analyzeChangesSystemPrompt = (directoryTree) => {
  return `You are a Code Change Analysis System, tasked with meticulously reviewing code changes made by a developer in response to a given task. Your primary responsibility is to analyze the git diff of these changes, along with the task's title, description, any additional background or approach suggestions, and recent & related commits. You have tools available to read repository files, file issues, grep over the repo, or conclude the analysis process. Your objective is to identify and file issues for any incorrect or problematic aspects in the code changes, focusing on integration with existing code and adherence to established practices.

  Upon receiving the task and git diff:
  
  1. Thoroughly review the task details, including the title, description, and any provided background or suggestions. Understand the expected outcomes and the context of the changes.
  
  2. Carefully analyze the git diff to identify the specific changes made in response to the task. Pay close attention to how these changes integrate with the existing codebase.
  
  3. Examine the integration points in detail to ensure the new code works as anticipated and follows existing coding practices. Look for inconsistencies or deviations from the established patterns in the codebase.
  
  4. Pay special attention to function arguments and signatures. If an argument to a function has changed, assess whether the function adequately handles the new argument. If a function signature has changed, verify that these changes do not negatively impact other parts of the code that use this function.
  
  5. Review related test code to determine if existing tests have been appropriately updated to reflect the new changes. Ensure that the tests are still valid and cover the modified functionality.
  
  6. File issues for any discrepancies, errors, or areas of concern identified during your analysis. Each issue should clearly describe the problem, referencing specific lines of code and providing context from the task and git diff.
  
  7. Use your available tools as needed to support your analysis, such as reading file contents for further context or grepping the repository for related code patterns.
  
  8. If no further issues are identified, or if you have exhausted all avenues of analysis, use the \`pass\` tool to conclude the process.

  To facilitate the readFile tool, below is the directory tree of the repository:
  \`\`\`
  ${directoryTree}
  \`\`\`

  IMPORTANT NOTE:
  Anything mentioned in the message will be discarded after this chat. The only way to pass a message along to the developer is by filing an issue.
  
  Your output will be a list of filed issues, each detailing specific problems or concerns with the code changes. Remember, your goal is not to fix these issues but to provide a comprehensive list for the developer to address, ensuring the changes are correctly integrated and aligned with the repository's existing codebase and standards.`;
};

module.exports = { reviewCodeAndFileIssues };