const { queryLlmWithJsonCheck } = require('../../../../llmService');

class IntegrationExpert {
  constructor(filePath, sourceCode) {
    this.filePath = filePath;
    this.sourceCode = sourceCode;
  }

  async getAdvice(taskString) {
    const query = assistanceQuery(taskString);
    const prompt = systemPrompt(this.sourceCode);
    const advice = await queryLlmWithJsonCheck([{role: 'system', content: prompt}, {role: 'user', content: query}], validateAssistanceResponse);
    advice.filePath = this.filePath;
    return advice;
  }
  
  async searchForIntegration(possibleIntegrationCode) {
    const res = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt(this.sourceCode)}, {role: 'user', content: searchQuery(possibleIntegrationCode)}], validateSearchQuery);
    return res.integrationFound;
  }
  
  async getIntegrationErrors(integrationCode) {
    const analysis = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt(this.sourceCode)}, {role: 'user', content: checkQuery(integrationCode)}], validateCheckQuery);

    const errors = [];
    for (const feedback of analysis.feedback) {
      const res = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt(this.sourceCode)}, {role: 'user', content: 'Review the analysis below. Return in json format any integration errors that the developer needs to fix. Use the following json format: `{errors: [\'a string describing the error here.\']}`.\n\n## Integration Analysis:\n```json\n' + JSON.stringify(feedback) + '\n```'}], (res) => {
        if (!res || !res.errors || !Array.isArray(res.errors)) {
          throw new Error('Response must be an object with an errors property that is an array.');
        }
        return res;
      });
      errors.push(...res.errors);
    }
    return errors;
  }
}

const assistanceQuery = (taskString) => {
  let query = 'Meticulously examine both the task\'s specifics and the functionalities offered by your source code. ';
  query += 'Your primary objective is to identify functions within the code that are pertinent to the task and to offer an in-depth analysis of each. ';
  query += 'This analysis will enable developers to effectively incorporate these functions into their solutions.';
  query += '\n\n';
  query += 'For each relevant function in your source code, your analysis will cover:\n';
  query += '1. Function name.\n';
  query += '2. A concise summary of the function\'s purpose and operation.\n';
  query += '3. Detailed information on input parameters, including type, order, and optional status.\n';
  query += '4. Types of expected return values. Give complete json structure of objects. If properties are arrays, give the types of values within those arrays. If you have nested objects, keep giving type information as deep as you reliably can. Explain what each property in an object does/means so that our end user can properly integrate and use the information.\n';
  query += 'For example, the return type could be:\n';
  query += '```\n';
  query += '{local: [{pathRelativeToRoot: string, line: Int, column: Int}], external: {name: string, line: Int, column: Int}}\n';
  query += '```\n';
  query += 'And the return type analysis could be:\n';
  query += '```\n';
  query += 'The function returns an object with 2 properties: local & external. Both are lists of dependencies either local or external to the project. For local dependencies, each dependency has:\n';
  query += '- pathRelativeToRoot: a relative path from the root of the repo\n';
  query += '- line: the line number of the source file on which the dependency is imported\n';
  query += '- column: the column number of the source file on which the dependency is imported\n';
  query += '...\n';
  query += '```\n';
  query += '5. Indication of whether the function might throw exceptions.\n';
  query += '6. Status of the function as asynchronous or synchronous.\n';
  query += '7. Whether the function is exported or not and tips on how to import it.\n';
  query += '8. Practical tips and considerations for integrating the function into the task\'s resolution. Be specific to the given function and task, don\'t offer generic or vague tips. Think about whether this function is critical for the task at hand. Don\'t merely consider completing the task but think about how to offer the best experience possible. When deliberating on the task, think deeply about what the overall goal is and don\'t take the task at just face value. We want to be extra critical when advising our developers, the ideal is to use the fewest lines of code and fewest integrations possible to fulfill the task in the best manner. If there is doubt, prefer to use fewer integrations and less code rather than adding superfluous features.\n\n';
  query += 'Your output will be structured as follows:\n';
  query += '```json\n';
  query += '{\n';
  query += '  "functions": [\n';
  query += '    {\n';
  query += '      "name": "FunctionName",\n';
  query += '      "summary": "A brief description of what the function accomplishes.",\n';
  query += '      "parameters": [\n';
  query += '        {"type": "TypeOfParameter1", "required": true, "description": ""},\n';
  query += '        {"type": "TypeOfParameter2", "required": false, "description": ""}\n';
  query += '        // Additional parameters as necessary\n';
  query += '      ],\n';
  query += '      "return": ["ReturnType1 in detailed, blown up json", "ReturnType2 in detailed, blown up json"], // If an object, detail the properties.\n';
  query += '      "returnAnalysis": ["Discussion of return type 1, what it means, how to use it. Go property by property for objects", "ditto for return type 2"],\n';
  query += '      "throws": true or false,\n';
  query += '      "async": true or false,\n';
  query += '      "exported": true or false,\n';
  query += '      "howToImport": "", // For example "const { extractDependencies } = require("path-to-file.js");\n';
  query += '      "tips": "Useful advice for integrating this function into the task."\n';
  query += '    }\n';
  query += '    // Include more functions as applicable\n';
  query += '  ]\n';
  query += '}\n';
  query += '\n\n';
  query += taskString;
  return query;
};

const validateAssistanceResponse = (response) => {
  if (!response || !response.functions || !Array.isArray(response.functions)) {
    throw new Error('Response must be an object with a functions property that is an array.');
  }
  for (const func of response.functions) {
    if (!func.name || !func.summary || !func.parameters || !Array.isArray(func.parameters) || !func.return || !Array.isArray(func.return) || !func.returnAnalysis || !Array.isArray(func.returnAnalysis) || typeof func.throws !== 'boolean' || typeof func.async !== 'boolean' || typeof func.exported !== 'boolean') {
      throw new Error('Each function must have a name, summary, parameters, return, returnAnalysis, throws, async, exported, howToImport, and tips property with the correct types.');
    }
  }
  return response;
};

const searchQuery = (possibleIntegrationCode) => {
  let query = 'Search the code below for any integrations with your critical source code.\n';
  query += 'Reply with the following json object indicating the presence or lack thereof of an integration:\n';
  query += '```json\n';
  query += '{\n';
  query += '  "integrationFound": true or false\n';
  query += '}\n';
  query += '```\n';
  query += '\n\n';
  query += '## Code to Search:\n';
  query += '```\n';
  query += possibleIntegrationCode;
  query += '\n```\n\n';
  return query;
};

const validateSearchQuery = (response) => {
  if (!response || typeof response.integrationFound !== 'boolean') {
    throw new Error('Response must be an object with an integrationFound property.');
  }
  return response;
};

const checkQuery = (integrationCode) => {
  let query = 'Analyze the integration with your source code below. ';
  query += 'Think carefully about how the developer is using your code. ';
  query += 'Pay particular attention to the inputs of the integrated function and whether they will cause any issues. ';
  query += 'Also pay close attention to the how the outputs of the integrated function are used. ';
  query += 'You are responsible for detecting any errors in the integration and providing detailed feedback on how to fix them. ';
  query += 'Return your analysis in the following format:\n\n';
  query += '```json\n';
  query += '{\n';
  query += '  "feedback": [{\n'; 
  query += '    "integratedFunctionName": "this should be a function from your source code above that is used in the file contents below",\n';
  query += '    "inputs": "analysis on the inputs to the integrated function",\n';
  query += '    "outputs": "analysis on the outputs of the integrated function and how they are accessed. Trace the outputs through the code and make note of all accesses, even to nested objects or objects in nested arrays."\n';
  query += '  }]\n';
  query += '}\n';
  query += '```\n';
  query += '\n\n';
  query += '## Integration Case Study\n';
  query += '```\n';
  query += integrationCode;
  query += '\n```\n\n';
  return query;
};

const validateCheckQuery = (response) => {
  if (!response || !response.feedback || !Array.isArray(response.feedback)) {
    throw new Error('Response must be an object with a feedback property that is an array.');
  }
  for (const feedback of response.feedback) {
    if (!feedback.integratedFunctionName || !feedback.inputs || !feedback.outputs) {
      throw new Error('Each feedback object must have an integratedFunctionName, inputs, and outputs property.');
    }
  }
  return response;
};

const systemPrompt = (code) => {
  let prompt = 'You are a code integration specialist, charged with overseeing all integrations of one critical file. ';
  prompt += 'The source code for your file is below:\n\n';
  prompt += '## Your Critical Source Code\n';
  prompt += '```\n';
  prompt += code;
  prompt += '\n```\n\n';
  prompt += 'You are responsible for nailing perfect integrations with any developer who needs the functionalities your code offers. '; 
  prompt += 'Do your best to use the context of the code above, your knowledge of javascript, and the details in developer messages to assist them in properly integrating the code.';
  return prompt;
};

module.exports = IntegrationExpert;