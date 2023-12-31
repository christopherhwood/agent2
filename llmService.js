const { OpenAI } = require('openai');
const { fetchInvestigationData } = require('./repoAnalysis');
const { prepareConfirmationQuery } = require('./llmQueries');   

const openai = new OpenAI(process.env.OPENAI_API_KEY);

/**
 * Queries GPT-4 and checks if the response is in JSON format.
 * 
 * @param {string} query - The query to send to GPT-4.
 * @param {string} systemPrompt - The system prompt to use for the query.
 * @returns {object} - The JSON response from GPT-4.
 * @throws Will throw an error if the response is not in valid JSON format.
 */
async function queryLlmWithJsonCheck(query, systemPrompt = '') {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [{role: 'system', content: systemPrompt}, {role: 'user', content: query}],
      max_tokens: 4096,
      temperature: 0,
      top_p: 1,
      response_format: {type: 'json_object'}
    });

    // Attempt to parse response as JSON
    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (jsonError) {
      console.error('Error parsing JSON response from LLM:', jsonError);
      throw new Error('Received ill-formatted JSON response from LLM.');
    }
  } catch (error) {
    console.error('Error querying LLM:', error);
    throw error;
  }
}

async function confirmInvestigationDataWithLlm(taskDescription, initialContext, investigationData, repoName) {
  let iterationCount = 0;
  let currentInvestigationData = investigationData;

  while (iterationCount < 3) {
    // Prepare the confirmation query for LLM
    const confirmationQuery = prepareConfirmationQuery(taskDescription, initialContext, currentInvestigationData);

    // Query LLM and check if the response is in JSON format
    const llmResponse = await queryLlmWithJsonCheck(confirmationQuery);
      
    // Check if LLM response indicates that the current data is sufficient
    if (llmResponse.files.length === 0 && llmResponse.commits.length === 0) {
      return currentInvestigationData; // Data is sufficient
    }

    // Check if LLM's response is a subset of current investigation data
    if (isSubsetOfCurrentData(llmResponse, currentInvestigationData)) {
      return currentInvestigationData; // Data is sufficient
    }

    // Update investigation data with additional files/commits suggested by LLM
    const additionalData = await fetchInvestigationData(llmResponse, repoName);
    currentInvestigationData = mergeInvestigationData(currentInvestigationData, additionalData);

    iterationCount++;
    console.log(`Iteration ${iterationCount} complete.`);
  }

  return currentInvestigationData; // Return the final accumulated investigation data
}

function mergeInvestigationData(existingData, additionalData) {
  const mergedFiles = [...new Set([...existingData.files, ...additionalData.files])];
  const mergedCommits = [...new Set([...existingData.commits, ...additionalData.commits])];

  return { files: mergedFiles, commits: mergedCommits };
}

function isSubsetOfCurrentData(llmResponse, currentData) {
  const allFiles = new Set(currentData.files.map(file => file.name));
  const allCommits = new Set(currentData.commits.map(commit => commit.hash));

  return llmResponse.files.every(file => allFiles.has(file)) &&
         llmResponse.commits.every(commit => allCommits.has(commit));
}


module.exports = {
  queryLlmWithJsonCheck,
  confirmInvestigationDataWithLlm
};
