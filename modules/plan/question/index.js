const { queryLlmWithJsonCheck } = require('../../../llmService');

async function askRepositoryQuestions(taskDescription, repoName, repoSummary) {
  const response = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: query(taskDescription, repoSummary)}], validateQuestionResponse);
  return response.questions;
}

function validateQuestionResponse(llmResponse) {
  if (typeof llmResponse === 'object' && Array.isArray(llmResponse.questions) && llmResponse.questions.every(question => typeof question === 'string' && question.length > 0)) {
    return llmResponse;
  }
  throw new Error('Invalid JSON format. ' + JSON.stringify(llmResponse));
}

const systemPrompt = `You are a Clarifying Questions Generator for Repository Analysis. Your task is to examine a JavaScript repository's summary and a specific coding task, then generate a JSON-structured list of questions. These questions are designed to fill knowledge gaps and guide the development of a plan that fits seamlessly into the existing codebase. Your goal is to ensure that every aspect of the implementation is justified and aligned with the repository's current state and style.

Upon analyzing the repository summary and task:

1. Review the repository's structure, coding patterns, design principles, and third-party library usage as detailed in the summary.

2. Develop questions that seek clarification on how best to integrate the new task with the existing codebase. Focus on aspects like design choices, file organization, preferred libraries, and coding standards.

3. Use the existing repository code as a basis for making informed guesses, forming a rationale for each decision in the implementation of the task.

4. Prepare questions that anticipate potential inquiries in a future code review, ensuring that every implementation decision is backed by reasoning rooted in the repository's existing code and style.

5. Structure your output as a JSON object containing a list of clarifying questions. The format should be:
   \`\`\`json
   {
     "questions": [
       "Question 1 related to design choices based on existing pages?",
       "Question 2 on selecting third-party libraries in line with current usage?",
       // Add more questions as needed
     ]
   }
   \`\`\`

Your output, a list of structured questions, will provide the necessary insights to develop a detailed and justified implementation plan. This plan should integrate the new task into the repository while maintaining consistency in design, coding style, and technology choices.`;

const query = (taskDescription, repoSummary) => `Given the below task description and repository summary, what questions about the repository would you ask before putting together a plan for how to implement the task in the repository?  Focus your questions on what the repository can answer. Use the existing repository code and your best guesses to fill in questions about the task itself. For example, if the task is to generate an About Us webpage and you wonder what color the background should be, look at what background other pages use and base your decision off of that.\n\n# Task\n${taskDescription}\n\n# Repository Summary\n${repoSummary}`;

module.exports = { askRepositoryQuestions };