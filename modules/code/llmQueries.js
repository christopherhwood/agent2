function prepareTaskResolutionQuery(targetTask, rootTask, fileCodeMap) {
  let query = '# Task\n';
  const buildTaskTree = (level, task) => {
    // Build a query like: 
    // ## Top Level Task Title
    // Top Level Task Description
    // ### Child Task Title
    // Child Task Description
    if (task === targetTask) {
      query += `${'#'.repeat(level + 1)} TODO - ${task.title}\n`;
    } else {
      query += `${'#'.repeat(level + 1)} ${task.title}\n`;
    }
    query += `${task.description}\n`;
    if (task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        if (!buildTaskTree(level + 1, subtask)) {
          return false;
        }
      }
    } else if (task.title[0] !== '~') {
      return false;
    }
    return true;
  };
  buildTaskTree(0, rootTask);
  
  query += '# Key Code Snippets\n\n';
  for (const fileName of Object.keys(fileCodeMap)) {
    query += `## ${fileName}\n`;
    for (const codeSnippet of fileCodeMap[fileName]) {
      query += `\`\`\`\n${codeSnippet}\n\`\`\`\n\n`;
    }
  }
  query += '# Request\n';
  query += 'Use the tools at your disposal to resolve the above task. ';
  query += 'Focus on the task tagged as TODO. If no changes are required, use the pass function in your tools. ';

  return query;
}

function prepareTaskResolutionConfirmationQuery(targetTask, rootTask, fileCodeMap, context) {
  let query = '# Task\n';
  const buildTaskTree = (level, task) => {
    // Build a query like: 
    // ## Top Level Task Title
    // Top Level Task Description
    // ### Child Task Title
    // Child Task Description
    if (task === targetTask) {
      query += `${'#'.repeat(level + 1)} TODO - ${task.title}\n`;
    } else {
      query += `${'#'.repeat(level + 1)} ${task.title}\n`;
    }
    query += `${task.description}\n`;
    if (task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        if (!buildTaskTree(level + 1, subtask)) {
          return false;
        }
      }
    } else if (task.title[0] !== '~') {
      return false;
    }
    return true;
  };
  buildTaskTree(0, rootTask);
  
  for (const key of Object.keys(context)) {
    query += `# ${key[0].toUpperCase() + key.slice(1)}\n\`\`\`\n${context[key]}\n\`\`\`\n\n`;
  }
  query += '# Key Code Snippets (prior to diff above)\n\n';
  for (const fileName of Object.keys(fileCodeMap)) {
    query += `## ${fileName}\n`;
    for (const codeSnippet of fileCodeMap[fileName]) {
      query += `\`\`\`\n${codeSnippet}\n\`\`\`\n\n`;
    }
  }
  query += '# Request\n';
  query += 'Examine the above task and git diff. Determine if the task is complete and the git diff is accurate. ';
  query += 'If the task is complete and the git diff is accurate, use the pass function in your tools. If not, use the tools at your disposal to resolve the task. ';
  query += 'Use best practices for your javascript code and ensure that your code is readable, well documented, executable, and completely fulfills the requirements of the current task. ';
  return query;
}

module.exports = {
  prepareTaskResolutionQuery,
  prepareTaskResolutionConfirmationQuery
};
