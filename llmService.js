const { OpenAI } = require('openai');

const openai = new OpenAI(process.env.OPENAI_API_KEY);

/**
 * Queries GPT-4.
 * 
 *  * @param {[object]} messages - The message history to send to GPT-4.
 * Should be formatted as an array of objects with properties 'role' and 
 * 'content'.
 * @returns {string} - The response from GPT-4.
 * @throws Will throw an error if the query fails.
 */
async function queryLlm(messages) {
  console.log('messages:');
  console.log(messages);
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: messages,
      max_tokens: 4096,
      temperature: 0,
      top_p: 1,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error querying LLM:', error);
    throw error;
  }
}

/**
 * Queries GPT-4, checks if the response is in JSON format, and applies a dynamic JSON validation function.
 * 
 * @param {[object]} messages - The message history to send to GPT-4, formatted as an array of objects with 'role' and 'content'.
 * @param {function} validateJsonResponse - A function to dynamically validate and possibly modify the JSON response. 
 * This function should take a JSON object as input and return a validated/modified JSON object.
 * @returns {object} - The validated and possibly modified JSON response from GPT-4.
 * @throws Will throw an error if the response is not in valid JSON format or if the validation function finds issues.
 */
async function queryLlmWithJsonCheck(messages, validateJsonResponse) {
  console.log('messages:');
  console.log(messages);
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: messages,
      max_tokens: 4096,
      temperature: 0,
      top_p: 1,
      response_format: {type: 'json_object'}
    });

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(response.choices[0].message.content);
    } catch (jsonError) {
      console.error('Error parsing JSON response from LLM:', jsonError);
      throw new Error('Received ill-formatted JSON response from LLM.');
    }

    // Apply dynamic validation passed as a parameter
    if (validateJsonResponse && typeof validateJsonResponse === 'function') {
      return validateJsonResponse(jsonResponse);
    }

    return jsonResponse;
  } catch (error) {
    console.error('Error querying LLM:', error);
    throw error;
  }
}

/**
 * Iteratively queries the LLM with a given query and refines the query based on LLM's responses. 
 * This function maintains a history of messages exchanged during the query iterations for context-aware responses. 
 * It continues iterating until either the response is deemed sufficient or a maximum of three iterations is reached.
 *
 * @param {string} initialQuery - The initial query to start the conversation with the LLM.
 * @param {function} refineQueryFunction - A function that takes the LLM's response and the current query, 
 *                                         and returns a refined query for the next iteration. This function should be asynchronous.
 * @param {function} isResponseSufficientFunction - A function that evaluates the LLM's response to determine if it meets the required criteria.
 * @param {string} systemPrompt - A system prompt that provides initial context or instructions to the LLM.
 * @param {function} queryFunction - A function to execute the LLM query. This function should accept the message history as an argument
 *                                   and return the LLM's response. It can be a standard query function or one with additional validation logic.
 * @returns {Promise<string|object>} - The final response from the LLM after the iterations. The response can be a string or a JSON object, 
 *                                     depending on how the queryFunction processes it.
 */
async function iterateLlmQuery(
  initialQuery, 
  refineQueryFunction, 
  isResponseSufficientFunction, 
  systemPrompt,
  queryFunction // Pass the query function (queryLlm or queryLlmWithJsonCheck)
) {
  let iterationCount = 0;
  let currentQuery = initialQuery;
  let messageHistory = [{role: 'system', content: systemPrompt}]; // Initialize message history

  let llmResponse = null;
  while (iterationCount < 3) {
    // Add the current query to message history
    messageHistory.push({role: 'user', content: currentQuery});

    // Query LLM with the accumulated message history
    llmResponse = await queryFunction(messageHistory);

    if (isResponseSufficientFunction(llmResponse)) {
      return llmResponse; // The response is sufficient
    }

    // Stringify llmResponse if it's an object
    const responseContent = typeof llmResponse === 'object' ? JSON.stringify(llmResponse) : llmResponse;

    // Refine the query based on GPT's response and update the message history
    currentQuery = await refineQueryFunction(llmResponse, currentQuery);
    messageHistory.push({role: 'assistant', content: responseContent}); // Add LLM's response to history

    iterationCount++;
    console.log(`Iteration ${iterationCount} complete.`);
  }

  return llmResponse; // Return the last GPT response
}

module.exports = {
  queryLlm,
  queryLlmWithJsonCheck,
  iterateLlmQuery
};
