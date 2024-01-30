const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');
const path = require('path');

const openai = new OpenAI(process.env.OPENAI_API_KEY);

const genBookmarkPath = () => {
  const uuid = uuidv4().toString();
  const tmpDir = os.tmpdir();
  const bookmarkPath = path.join(tmpDir, `qckfx-agent-payload-${uuid}.json`);
  return bookmarkPath;
};

/**
 * Queries GPT-4.
 * 
 *  * @param {[object]} messages - The message history to send to GPT-4.
 * Should be formatted as an array of objects with properties 'role' and 
 * 'content'.
 * @returns {string} - The response from GPT-4.
 * @throws Will throw an error if the query fails.
 */
async function queryLlm(messages, temperature=0) {
  const bookmarkPath = genBookmarkPath();
  console.log(bookmarkPath + ' messages:');
  console.log(messages);

  const payload = {
    model: 'gpt-4-0125-preview',
    messages: messages,
    max_tokens: 4096,
    temperature: temperature,
    top_p: 1,
  };
  
  fs.writeFileSync(bookmarkPath, JSON.stringify(payload));
  try {
    const response = await openai.chat.completions.create(payload);

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error querying LLM:', error);
    if (error.status === 429) {
      // wait 15 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 15000));
      return await queryLlm(messages, temperature);
    }
    throw error;
  }
}

/**
 * Queries GPT-4, checks if the response is in JSON format, and applies a dynamic JSON validation function.
 * 
 * @param {[object]} messages - The message history to send to GPT-4, formatted as an array of objects with 'role' and 'content'.
 * @param {function} validateJsonResponse - A function to dynamically validate and possibly modify the JSON response. 
 * This function should take a JSON object as input and return a validated/modified JSON object.
 * @param {number} tries - The number of times the query has been attempted.
 * @returns {object} - The validated and possibly modified JSON response from GPT-4.
 * @throws Will throw an error if the response is not in valid JSON format or if the validation function finds issues.
 */
async function queryLlmWithJsonCheck(messages, validateJsonResponse, temperature=0, tries = 0) {
  const bookmarkPath = genBookmarkPath();
  console.log(bookmarkPath + ' messages:');
  console.log(messages);

  const payload = {
    model: 'gpt-4-0125-preview',
    messages: messages,
    max_tokens: 4096,
    temperature: temperature,
    top_p: 1,
    response_format: {type: 'json_object'}
  };
  fs.writeFileSync(bookmarkPath, JSON.stringify(payload));
  try {
    const response = await openai.chat.completions.create(payload);

    let jsonResponse;
    console.log('JSON response: ' + response.choices[0].message.content);
    try {
      jsonResponse = JSON.parse(response.choices[0].message.content);

      // Apply dynamic validation passed as a parameter
      if (validateJsonResponse && typeof validateJsonResponse === 'function') {
        return validateJsonResponse(jsonResponse);
      }
    } catch (jsonError) {
      console.error('Error parsing JSON response from LLM:', jsonError, 'Content: ', response.choices[0].message.content);
      if (tries < 3) {
        return await queryLlmWithJsonCheck([...messages, response.choices[0].message, {role: 'user', content: 'You must provide a valid JSON response. ' + jsonError}], validateJsonResponse, temperature, tries + 1);
      }
      throw new Error('Received ill-formatted JSON response from LLM.');
    }

    return jsonResponse;
  } catch (error) {
    console.error('Error querying LLM:', error);
    if (error.status === 429) {
      // wait 15 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 15000));
      return await queryLlm(messages);
    }
    throw error;
  }
}

async function queryLlmWTools(messages, tools, toolRouter, forceToolSelection = false, temperature = 0, tries = 0) {
  const bookmarkPath = genBookmarkPath();
  console.log(bookmarkPath + ' messages:');
  console.log(messages);
  console.log('tools:');
  console.log(tools);
  const payload = {
    model: 'gpt-4-0125-preview',
    messages: messages,
    max_tokens: 4096,
    temperature: temperature,
    top_p: 1,
    tools: tools,
    tool_choice: 'auto'
  };
  fs.writeFileSync(bookmarkPath, JSON.stringify(payload));
  try {
    const response = await openai.chat.completions.create(payload);

    console.log('LLM Tool Assistant Message: ' + JSON.stringify(response.choices[0].message));

    messages.push(response.choices[0].message);

    let toolCalls = response.choices[0].message.tool_calls;
    let toolCallResponses = [];
    if (toolCalls && toolCalls.length > 0) {
      if (toolCalls[0].function.name === 'pass') {
        return messages;
      }
      // Filter out any tool calls that don't match toolcall regexp: ^[a-zA-Z0-9_-]{1,64}$
      toolCalls = toolCalls.filter(toolCall => /^[a-zA-Z0-9_-]{1,64}$/.test(toolCall.function.name));
      
      toolCallResponses = await Promise.allSettled(toolCalls.map(async toolCall => {
        let response = {
          tool_call_id: toolCall.id,
          role: 'tool',
          name: toolCall.function.name
        };

        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (err) {
          response.content = `Error parsing arguments for tool call ${toolCall.function.name}: ${err}`;
          return response;
        }
        
        let output;
        try {
          output = await toolRouter.routeToolCall({function: toolCall.function.name, arguments: args, id: toolCall.id});
        } catch (err) {
          response.content = `Error executing tool call ${toolCall.function.name}: ${err}`;
          return response;
        }
        
        response.content = output;
        return response;
      }));

      toolCallResponses = toolCallResponses.map(toolCallResponse => toolCallResponse.value);

      // Validate the tool calls in the message
      messages.pop();
      const lastMessageWithBadToolCallsFiltered = response.choices[0].message;
      lastMessageWithBadToolCallsFiltered.tool_calls = toolCalls;

      // If the last message is now invalid, then we just remove it and retry.
      if (!lastMessageWithBadToolCallsFiltered.content && (!toolCalls || toolCalls.length === 0)) {
        return await queryLlmWTools(messages, tools, toolRouter, forceToolSelection, temperature, tries);
      }
      messages.push(lastMessageWithBadToolCallsFiltered, ...toolCallResponses);
      return await queryLlmWTools(messages, tools, toolRouter, forceToolSelection, temperature, tries);
    } else if (forceToolSelection) {
      messages.push({role: 'user', content: 'You must use at least one tool in your response.'});
      return await queryLlmWTools(messages, tools, toolRouter, forceToolSelection, temperature, tries);
    }
      
    
    messages.push(response.choices[0].message);
    return messages;
  } catch (error) {
    console.error('Error querying LLM:', error);
    if (error.status === 429) {
      // wait 15 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 15000));
      return await queryLlmWTools(messages, tools, toolRouter, forceToolSelection, temperature, tries);
    }
    throw error;
  }
}

async function queryLlmWithTools(messages, tools, temperature, forceToolChoice = true, tries = 0) {
  const bookmarkPath = genBookmarkPath();
  console.log(bookmarkPath + ' messages:');
  console.log(messages);
  console.log('tools:');
  console.log(tools);
  
  const payload = {
    model: 'gpt-4-0125-preview',
    messages: messages,
    max_tokens: 4096,
    temperature: temperature,
    top_p: 1,
    tools: tools,
    tool_choice: 'auto'
  };
  fs.writeFileSync(bookmarkPath, JSON.stringify(payload));
  try {
    const response = await openai.chat.completions.create(payload);

    console.log('LLM Tool Assistant Message: ' + JSON.stringify(response.choices[0].message));
    let toolCalls = response.choices[0].message.tool_calls;
    if (forceToolChoice || (toolCalls && toolCalls.length > 0)) {
      try {
        validateToolCalls(toolCalls, tools);
      } catch (error) {
        console.error('Error validating tool calls:', error);
        if (tries < 3) {
          return await queryLlmWithTools([...messages, {role: 'assistant', content: JSON.stringify({content: response.choices[0].message.content, tool_calls: response.choices[0].message.tool_calls})}, {role: 'user', content: 'You must correctly use the tools provided. You must use at least one tool in your response. ' + error.message}], tools, temperature, forceToolChoice, tries + 1);
        } else {
          throw error;
        }
      } 

      toolCalls = toolCalls.map(toolCall => {
        return {
          id: toolCall.id,
          function: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        };
      });
    } else {
      toolCalls = [];
    }
    console.log('LLM Tool Calls: ' + JSON.stringify(toolCalls));
    return {toolCalls, messages: [...messages, response.choices[0].message]};
  } catch (error) {
    console.error('Error querying LLM:', error);
    if (error.status === 429) {
      // wait 15 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 15000));
      return await queryLlmWithTools(messages, tools, temperature, tries);
    }
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

    // Refine the query based on GPT's response and update the message history
    currentQuery = await refineQueryFunction(llmResponse, currentQuery);
    const { content, tool_calls } = llmResponse.messages[llmResponse.messages.length - 1];
    messageHistory.push({role: 'assistant', content: JSON.stringify({content, tool_calls})}); // Add LLM's response to history, but add it as content so we don't have to respond to the tool use.

    iterationCount++;
    console.log(`Iteration ${iterationCount} complete.`);
  }

  return llmResponse; // Return the last GPT response
}

function validateToolCalls(toolCalls, tools) {
  // Tool call looks like this: 
  // {
  //   function: {
  //     name: 'createFile',
  //     arguments: "{path: 'src/index.js', contents: 'console.log('Hello, world!')'}"
  //   }
  // }
  
  // Tool looks like this: 
  // {
  //    type: 'function',
  //    function: {
  //      name: 'createFile',
  //      description: 'Creates a new file with the provided contents. Useful for creating new files for functions or logic that does not belong in existing files.',
  //      parameters: {
  //        type: 'object',
  //        properties: {
  //          path: {
  //            type: 'string',
  //            description: 'The relative path to the file to create. Paths must be relative to the root of the repository.'
  //          },
  //          contents: {
  //            type: 'string',
  //            description: 'The contents to write to the file.'
  //          }
  //        },
  //        required: ['path', 'contents']
  //      }
  //    }
  //  }

  // The goal of this function is to validate that the tool calls are valid and match the tools provided.
  // This function should throw an error if the tool calls are invalid.
  // This function should also throw an error if the tool calls don't match the tools provided.
  // This function should return true if the tool calls are valid and match the tools provided.

  // Validate that the tool calls are valid
  for (const toolCall of toolCalls) {
    const tool = tools.find(tool => tool.function.name === toolCall.function.name);
    if (!tool) {
      throw new Error(`Tool call ${toolCall.function.name} is invalid.`);
    }
    // Validate that the required properties are present
    const toolParameters = tool.function.parameters.required;
    if (!toolParameters) {
      return true; // No required parameters
    }

    const toolCallParameters = JSON.parse(toolCall.function.arguments);
    for (const parameter of toolParameters) {
      if (!toolCallParameters[parameter]) {
        throw new Error(`Tool call ${toolCall.function.name} is missing required parameter ${parameter}.`);
      }
    }
  }
  return true;
}

module.exports = {
  queryLlm,
  queryLlmWithJsonCheck,
  queryLlmWTools,
  queryLlmWithTools,
  iterateLlmQuery
};
