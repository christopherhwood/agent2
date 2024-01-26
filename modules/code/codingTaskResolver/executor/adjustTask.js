const { queryLlmWithJsonCheck } = require('../../../../llmService');

async function adjustTask(task, originalGoal, integrationAdvice, keyFiles) {
  const res = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: query(task, originalGoal, integrationAdvice, keyFiles)}], validateAdjustTask);
  res.subtask.taskId = task.taskId;
  res.subtask.relatedCommits = task.relatedCommits;
  res.subtask.backgroundContext = task.backgroundContext;
  return res.subtask;
}

const query = (task, originalGoal, integrationAdvice, keyFiles) => {
  let query = '# Original High-Level Goal:\n' + originalGoal + '\n\n';
  query += '# Original Subtask\n\n';
  query += '## Title:\n' + task.title + '\n';
  query += '## Description:\n' + task.description + '\n';
  if (task.pseudocode && task.pseudocode.length > 0 && !task.pseudocode.includes('N/A')) {
    query += '## Pseudocode:\n';
    query += '```\n';
    query += `${task.pseudocode}\n`;
    query += '```\n\n';
  }
  query += '## Completion Criteria:\n' + task.completionCriteria + '\n';
  if (task.backgroundContext && task.backgroundContext.length > 0) {
    query += '## Background Context\n\n';
    query += task.backgroundContext + '\n\n';
  }
  if (task.relatedCommits && task.relatedCommits.length > 0) {
    query += '## Recent & Related Commits\n\n';
    query += task.relatedCommits + '\n\n';
  }
  query += '## Integration Advice for Relevant Existing Code\n\n';
  for (const advice of integrationAdvice) {
    query += '```json\n';
    query += `${JSON.stringify(advice)}\n`;
    query += '```\n\n';
  }
  query += '## Key Files\n\n';
  for (const keyFile of Object.keys(keyFiles)) {
    query += `**${keyFile}**\n\n`;
    query += '```javascript\n';
    query += `${keyFiles[keyFile]}\n`;
    query += '```\n\n';
  }
  return query;
};

const validateAdjustTask = (response) => {
  if (!response || !response.subtask) {
    throw new Error('Response must be an object with a subtask property');
  }
  if (!response.subtask.title || !response.subtask.description || !response.subtask.pseudocode || !response.subtask.completionCriteria) {
    throw new Error('Response must be an object with a subtask property that has a title, description, pseudocode, and completionCriteria property');
  }
  return response;
};


const systemPrompt = `You are a staff software engineer tasked with the critical role of revisiting and revising a subtask that was initially defined before a thorough exploration of the problem was completed. With new context and a deeper understanding of the original high-level goal (which the subtasks aim to accomplish bit by bit), your job is to meticulously review the original subtask and adapt it, ensuring it is both relevant and optimized based on the latest insights.

Pay particular attention to the specific details of the subtask and feel free to modify them as necessary. Closely scrutinize the details of the available integrations and determine which ones move us closer to the high-level goal and which ones are distractions or superfluous. Remember that the primary objective is to achieve the high-level goal in the most efficient and effective way possible, by minimizing the amount of code added and the number of integrations required and keeping the logic as simple as possible.

Your responsibilities involve:

1. Carefully examining the new context and information that has emerged since the original subtask was created.
2. Analyzing the nature of the original subtask, including its title, description, pseudocode, and completion criteria, rather than taking it at face value.
3. Assessing whether the original subtask is still applicable in light of the new context.
4. Determining if the approach outlined in the original subtask remains the best way to achieve the objectives, or if a different approach is now more suitable.

Your goal is to craft a revised subtask that:

a) Aligns with the nature and intent of the original task.
b) Incorporates the newly discovered information to optimize the approach.
c) Is straightforward, highly detailed, and relatively simple, tailored for implementation by a junior engineer.

You will output the new subtask in a JSON format, ensuring clarity and comprehensiveness in its description. The format of your response should be as follows:
\`\`\`json
{
  "subtask": {
    "title": "Revised Subtask Title",
    "description": "Detailed description of the revised subtask, explaining the context, objectives, and the rationale behind the chosen approach.",
    "pseudocode": "Clear and concise pseudocode outlining the steps or logic to be implemented, designed for ease of understanding and execution by a junior engineer.",
    "completionCriteria": "Precise and detailed criteria that define the successful completion of the subtask, adjusted to reflect the new context and objectives."
  }
}
\`\`\`

In creating this new subtask, you should leverage your expertise to ensure that it not only addresses the original task's intent but also makes the best possible use of the new information, guiding the junior engineer towards an effective and efficient implementation.

The new subtask will replace the original subtask, so be sure to include all relevant information. Do not make references back to the original subtask as it will be deleted.`;

module.exports = { adjustTask };