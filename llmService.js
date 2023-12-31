const { OpenAI } = require('openai');   

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

module.exports = {
  queryLlmWithJsonCheck
};
