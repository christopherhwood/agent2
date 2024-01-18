const { queryLlm, queryLlmWithTools } = require('../../../llmService');
const NonCoder = require('./nonCoder');
const { getRepoContext } = require('../../summary/codePicker');

async function resolveNonCodingTask(task, nonCoder) {
  const repoContext = await getRepoContext(nonCoder.repoName);
  return await sendToolQuery(task, repoContext, nonCoder);
}

// Works w/ LLM until no more tool calls, then returns summary of message history
async function sendToolQuery(task, repoContext, nonCoder, messageHistory) {
  if (!messageHistory) {
    messageHistory = [{role: 'system', content: ToolSytemPrompt}, {role: 'user', content: query(task, repoContext)}];
  }

  const {toolCalls, messages} = await queryLlmWithTools(messageHistory, nonCoder.getTools(), 0, false /* force tool choice */);
  console.log('Response from LLM:');
  console.log(toolCalls);
  // Execute response
  let toolResponses = [];
  for (const toolCall of toolCalls) {
    if (toolCall.function == 'pass') {
      break;
    }
    let toolResponse = {tool_call_id: toolCall.id, role: 'tool', name: toolCall.function};
    toolResponse.content = await nonCoder.routeToolCall(toolCall);
    toolResponses.push(toolResponse);
  }

  if (toolResponses.length > 0) {
    return await sendToolQuery(task, repoContext, nonCoder, [...messages, ...toolResponses]);
  }
  // strip the first (system) message from the message history
  const strippedMessages = messages.slice(1);

  // Ensure the last message has content. Sometimes tool call messages have no content.
  if (!strippedMessages[strippedMessages.length - 1].content && strippedMessages[strippedMessages.length - 1].tool_calls) {
    strippedMessages[strippedMessages.length - 1].content = JSON.stringify(strippedMessages[strippedMessages.length - 1].tool_calls);
  }
  // Remove the tool call in case it was 'pass' or invalid (which would throw an error)
  delete strippedMessages[strippedMessages.length - 1].tool_calls;
  return await queryLlm([{role: 'system', content: SummarizeSystemPrompt}, ...strippedMessages, {role: 'user', content: 'Please summarize the above conversation, highlighting the key points and takeaways.'}]);
}

const query = (task, repoContext) => {
  let query = '# Task (in json)\n';
  query += `\`\`\`json\n${JSON.stringify(task)}\n\`\`\`\n\n`;
  query += '# Repository Context\n';
  query += '## Directory Tree\n';
  query += '```\n';
  query += `${repoContext.directoryTree}\n`;
  query += '```\n';
  query += '## Recent Commits\n';
  query += '```\n';
  query += `${repoContext.recentCommits}\n`;
  query += '```\n\n';
  query += '# Request\n';
  query += 'Use the tools at your disposal to resolve the above task. ';
  query += 'Refer to the completion criteria to ensure the task is completely resolved.\n';
  query += 'If no changes are required, use the pass function in your tools. ';
  return query;
};

const SummarizeSystemPrompt = `You are a Conversation Summarizer System, tasked with reviewing a message history that includes interactions between the user, assistant, and various tools. Your role is to synthesize the key points from this conversation, focusing on the responses provided by tools and the assistant, and summarize them in a way that addresses and resolves the original task given by the user.

Upon reviewing the message history:

1. Identify the original task or question posed by the user. Understand the context and the specific objectives of the task.

2. Examine the message history for tool use, such as \`readFile\`, \`reviewDiffsInPR\`, or any other tool that was employed in response to the task. Note the key insights or findings delivered by these tools.

3. Pay attention to the assistant's responses, especially those that integrate or interpret the information provided by the tools. Highlight any critical analysis, conclusions, or recommendations made by the assistant.

4. Compile the essential points from the tool responses and the assistant's analysis into a coherent summary. This summary should encapsulate the main findings, insights, and conclusions drawn throughout the conversation.

5. Ensure that your summary directly addresses the original user task, providing a clear resolution or answer based on the accumulated information from the conversation.

6. Format your summary in a clear, concise manner, making it easy for the user to understand how the conversation led to the resolution of their task.

Your output will be a structured summary of the conversation, highlighting the key points and insights derived from tool usage and the assistant's responses, all focused on resolving the user's original task. This summary serves as a concise overview of the conversation, providing the user with a clear understanding of how their task was addressed and concluded.`;

const ToolSytemPrompt = `
  You are a Non-Coding Task Resolver System, designed to facilitate the completion of non-coding tasks such as code reviews and file readings. Your role is to assist in tasks that involve understanding and analyzing the codebase, rather than directly writing or editing code. You have access to tools like \`readFile\` and \`reviewDiffsInPR\` to support these activities. Your input includes specific tasks, each with a title, description, and completion criteria.

  Upon receiving a non-coding task:
  
  1. Analyze the task details, including the title, description, and completion criteria. Understand the specific objectives and requirements of the task.
  
  2. Use the \`readFile\` function to access and review the content of specified files within the task. For example, if the task involves familiarizing with the codebase, read and analyze the relevant files to gain a comprehensive understanding.
  
  3. Utilize the \`reviewDiffsInPR\` tool to examine recent changes in pull requests if the task involves understanding recent modifications or updates to the code.
  
  4. If the task description includes dependencies, review these dependencies to understand how they influence or relate to the task at hand.
  
  5. Ensure the completion criteria are met. For example, if the task is to familiarize with the codebase, confirm that the developer can explain the workflow and interactions between the specified files.
  
  6. Provide feedback or guidance as needed to assist in task completion, drawing on your analysis and the tools at your disposal.
  
  Your output will be the resolution of the non-coding task, ensuring that the objectives are met, and the completion criteria are fulfilled. Additionally, you may generate new tasks as needed, each clearly defined and relevant to the overarching goals of the project.`;

module.exports = { resolveNonCodingTask, NonCoder };