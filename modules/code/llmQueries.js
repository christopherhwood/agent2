function prepareTaskResolutionQuery(taskString, fileContents) {
  let query = taskString;
  
  query += '# Key Files\n\n';
  for (const fileName of Object.keys(fileContents)) {
    query += `## ${fileName}\n`;
    query += `\`\`\`\n${fileContents[fileName]}\n\`\`\`\n\n`;
  }
  query += '# Request\n';
  query += 'Use the tools at your disposal to resolve the above task. ';
  query += 'Ensure that you completely resolve the last listed subtask. ';
  query += 'Parent tasks are given to provide more context.\n\n';
  query += 'If no changes are required, use the pass function in your tools. ';

  return query;
}

function prepareTaskResolutionConfirmationQuery(taskString, fileContents, context) {
  let query = taskString;

  for (const key of Object.keys(context)) {
    query += `# ${key[0].toUpperCase() + key.slice(1)}\n\`\`\`\n${context[key]}\n\`\`\`\n\n`;
  }
  
  query += '# Key Files\n\n';
  for (const fileName of Object.keys(fileContents)) {
    query += `## ${fileName}\n`;
    query += `\`\`\`\n${fileContents[fileName]}\n\`\`\`\n\n`;
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
