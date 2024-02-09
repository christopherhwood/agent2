const { v4: uuidv4 } = require('uuid');
const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { Container, executeCommand } = require('../../../../dockerOperations');
const { createEmbedding } = require('../../../search/ingestion/embedder');
const { selectRelatedCode } = require('../../../search/output/searchCode');
const { warnAboutInvalidFunctionCalls } = require('../analyzer/warnings/updateFunctionCalls');
const { analyzeNewCode } = require('../analyzer/index');

async function editCode(filePath, spec, styleGuide, repoName) {
  if (!filePath.startsWith('./')) {
    filePath = `./${filePath}`;
  }
  return await editCodeLoop(filePath, spec, styleGuide, [], repoName);
}

async function editCodeLoop(filePath, spec, styleGuide, messages, repoName, triesRemaining = 3) {
  const specEmbedding = await createEmbedding(spec);
  const relevantSnippets = await selectRelatedCode(repoName, specEmbedding, [filePath]);
  const res = await sendEditCodeRequest(filePath, spec, relevantSnippets, styleGuide, messages, repoName);
  const edits = res.edits;
  let outputs = [];
  for (const edit of edits) {
    try {
      const editRes = await tryToEditCode(filePath, edit, repoName);
      if (editRes.trim().length > 0) {
        outputs.push(editRes);
      }
    } catch (err) {
      edit.error = err.message;
    }
  }

  const errorEdits = edits.filter(edit => edit.error);
  if (errorEdits.length > 0) {
    if (triesRemaining > 0) {
      const editRes = await editCodeLoop(filePath, spec, styleGuide, [...messages, {role: 'assistant', content: JSON.stringify(res)}, {role: 'user', content: fixErrorQuery(edits)}], repoName, triesRemaining - 1);
      if (editRes.trim().length > 0) {
        outputs.push(editRes);
      }
    } else {
      console.log('Unfixed error edits:\n', errorEdits);
      return 'Editing was unsuccessful due to errors:\n\n```json\n' + JSON.stringify(errorEdits) + '\n```';
    }
  }
  return outputs.join('\n');
}

const fixErrorQuery = (edits) => {
  let query = 'One or more of your edits contained errors. Generally this is because the originalCode does not match exactly the file contents. Be sure the originalCode matches line for line with the file contents, including any spacing and comments. Pay close attention to the error message and resubmit a correct edit for the following edits:';

  for (const edit of edits) {
    if (edit.error) {
      query += `\n\n# Edit ${edit.id}\n${edit.error}`;
    }
  }
  return query;
};

async function sendEditCodeRequest(filePath, spec, relevantSnippets, styleGuide, messages, repoName) {
  const editQuery = await query(filePath, relevantSnippets, repoName);
  const firstEdit = await queryLlmWithJsonCheck([{role: 'system', content: createEditCodeSystemPrompt(styleGuide, spec)}, {role: 'user', content: editQuery}, ...messages], validateEditCode);

  // Copy the source file to a temp location
  const container = await Container.Create(repoName);
  const id = uuidv4().toString();
  await container.executeCommand(`mkdir -p /usr/src && cp ${filePath} /usr/src/temp-${id}`);
  let successful = [];
  for (const edit of firstEdit.edits) {
    try {
      await tryToEditCode(filePath, edit, repoName);
      successful.push(edit);
    } catch {
      // Do nothing   
    }
  }

  if (!successful.length) {
    await container.destroy();
    return firstEdit;
  }

  const newFileContents = await container.executeCommand(`cat ${filePath}`);
  const diff = await container.executeCommand(`git diff ${filePath}`);

  const secondEdit = await queryLlmWithJsonCheck([{role: 'system', content: createEditCodeSystemPrompt(styleGuide, spec)}, {role: 'user', content: editQuery}, ...messages, {role: 'assistant', content: JSON.stringify({edits: successful})}, {role: 'user', content: `Your edits have been applied.\n\nNow, take a close look at the new code below. Make new edits to fix any style guide deviations or areas where bugs coudld be introduced due to lack of error handling, potentially improper use of a function in terms of parameters or return type, or use of properties that may not be defined on an object. \nMake sure all edits are inline with the spec: ${spec}.\nReturn your new edits in json format.\n\nHere is the style guide:\n\n\`\`\`markdown\n${styleGuide}\n\`\`\`\n\nHere is the new code:\n\n\`\`\`javascript\n${newFileContents}\n\`\`\`\n\nThe change's diff is shown below to give context on what was added (+) and removed (-):\n${diff}`}], validateEditCode);

  // Undo edits
  await container.executeCommand(`cp /usr/src/temp-${id} ${filePath}`);
  await container.destroy();
  return {edits: firstEdit.edits.concat(secondEdit.edits)};
}

async function tryToEditCode(filePath, edit, repoName) {
  const uniqueId = uuidv4().toString();
  if (edit.originalCode !== undefined && edit.originalCode !== null && edit.newCode !== undefined && edit.newCode !== null) {
    const originalCode = edit.originalCode;
    const newCode = edit.newCode;
    // // Replace line breaks in original code with \n
    // const originalCode = edit.originalCode.replace(/\\n/g, '\n');
    // // Replace line breaks in new code with \n
    // const newCode = edit.newCode.replace(/\\n/g, '\n');

    // Create a container
    const container = await Container.Create(repoName);

    const oldFileContents = await container.executeCommand(`cat ${filePath}`);

    // Echo the code to a temp file in the container
    await container.executeCommand(`cat << 'EOF' > /usr/src/temp-${uniqueId}\n${newCode}\nEOF`);

    await container.executeCommand(`cat << 'EOF' > /usr/src/original-${uniqueId}\n${originalCode}\nEOF`);

    // Insert the code into the specified file using the /usr/bin/insertCode.js script
    let output = await container.executeCommand(`/usr/bin/replaceCode.js ${filePath} /usr/src/original-${uniqueId} /usr/src/temp-${uniqueId}`);
    
    try {
      if (output && output.trim().length > 0) {
        if (output.includes('Error:')) {
          output = '# Error\n' + output;
          output += `\n\n**Original File Contents at ${filePath}:**\n\`\`\`\n` + oldFileContents + '\n```'; 
          throw new Error(output);
        }
      } else {
        const newFileContents = await container.executeCommand(`cat ${filePath}`);
        output = '';
        if (edit.risk.length > 0) {
          output += '\n\nThe edit has the following risk: ' + edit.risk;
        }
        if (edit.style.length > 0) {
          output += '\n\nThe edit has the following style deviation: ' + edit.style;
        }
        const { analyzerErrors } = analyzeNewCode(newCode);
        for (const err of analyzerErrors) {
          output += `\n\n**ERROR:**\n${err}`;
        }
        const functionCallWarning = await warnAboutInvalidFunctionCalls(oldFileContents, newFileContents, repoName);
        console.log('functionCallWarning:', functionCallWarning);
        if (functionCallWarning) {
          output += '\n\n**WARNING:**\n' + functionCallWarning;
        }
      }
    } finally {
      await container.destroy();
    }
    return output.trim();
  }
}

const validateEditCode = (response) => {
  if (!response.edits) {
    throw new Error('Response must contain an "edits" field');
  }
  if (!Array.isArray(response.edits)) {
    throw new Error('Edits must be an array');
  }
  for (const edit of response.edits) {
    if (!edit.originalCode || (!edit.newCode && typeof edit.newCode !== 'string') || !edit.id || typeof edit.risk !== 'string' || typeof edit.style !== 'string') {
      throw new Error('Each edit must contain an "originalCode", "newCode", "id", "risk", and "style" field');
    }
  }
  return response;
};

const query = async (filePath, relevantSnippets, repoName) => {
  const fileContents = await executeCommand(`cat ${filePath}`, repoName);
  return `Write the new code and the code to replace for the file at ${filePath}. Use the json format {edits: [{originalCode: '', newCode: ''}]} to return the code.
  
  The existing code at ${filePath} is:
  \`\`\`javascript
  ${fileContents}
  \`\`\`
  
  Potentially relevant code snippets:
  \`\`\`json
  ${JSON.stringify(relevantSnippets)}
  \`\`\``;
};

const createEditCodeSystemPrompt = (styleGuide, spec) => {return `You are a senior software engineer working on a programming task. You are provided a file path identifying the file that we are editing, and an engineering spec for a task.

Your job is to write the javascript code for the new file. Each edit should be lean and concise. Use multiple edits if necessary to change code in different parts of the file (for example changing imports and writing a function). If no edits are required to satisfy the task and spec then you may return an empty array of edits.

You do not have to follow the spec exactly. The specs are intentionally written in a vague manner to allow for your creativity and flexibility. For example, if the spec asks you to better utilize an object, you can use your own judgement and understanding of the code to determine if anything needs to be done. If you're not sure how to better use the object or if you think the object is already being used in the best way, you can ignore the spec and return an empty array of edits.

This means that you are responsible for all bugs you write. Recklessly accessing properties that don't exist or passing incorrect arguments to functions or misusing the returned values of functions can all introduce bugs. You should avoid doing this at all costs.

Your output will be structured as follows, detailing the edits you propose:
\`\`\`json
{
  "edits": [
    {
      "id": "a unique id",
      "risk": "How the edit could introduce bugs. Consider how confident you are in the properties being accessed on objects, the parameters and return types of functions used, and obviously error handling. The point is to also explore risks inherent in using a dynamic language like Javascript. If there are none, return an empty string.",
      "style": "Explain any deviations from the style guide and why. Do NOT explain what you did correctly, only focus on the deviations. If there are none, then return an empty string.",
      "originalCode": "Exact subsection of the original code to be replaced, including comments and spacing. This cannot be an empty string. This must match _exactly_ the code in the file. If it does not, the command will fail. If the code contains comments, the comments must match _exactly_ what is in the source file. The original code will be removed in its entirety and replaced with the contents of newCode. Ensure you are only deleting the code that needs to be replaced. If you delete too much, you will break the codebase. If you delete too little, you will not fix the issue. Be careful.",
      "newCode": "The revised code snippet that corrects the identified issue. This will replace the originalCode exactly as written, including any comments, verbatim. Must follow the style guide below."
    },
    // Additional edits as necessary
  ]
}
\`\`\`

The newCode will replace the originalCode, meaning that the originalCode will be completely removed and the newCode will be copied directly as written, including any comments, verbatim. Be careful about what code is deleted. Only make changes as directed in the spec, do not go off script. Do not include anything in the newCode you wouldn't want to appear in the committed code.

Only write code you are confident about. **VERY IMPORTANT:** Do NOT assume the existence of modules, files, or properties on objects (not even the id property)! Our number one priority is to write code that will run and not crash. In the case of adding validations, it's better to add less and be correct than to add more and be incorrect.

When writing imports, follow the existing import syntax (es6, commonjs, etc). When doing dynamic imports in commonjs, try to always add them at the top level of the file unless you have a very good reason for doing otherwise. Try to avoid dynamic imports in es6 unless you have a very good reason for doing otherwise. Following this instruction will make it easier to understand the dependencies of the file and make it easier to statically analyze the code.

Don't remove comments unless they are rendered unnecessary by the code changes. If you are removing code that has comments, make sure to remove the comments as well. Be particularly careful about comments tagged TODO, FIXME, etc.

Be wary when editing functions that are currently in use. If you change the function signature, you will need to update all calls to that function. If you change the function body, you will need to ensure that the new code does not break any existing functionality. It may be easier sometimes to create a new function that accomplishes your goals rather than trying to edit an existing function. However, bare in mind that this will increase the amount of code in the codebase and the maintenance burden.

Be careful when integrating with existing code. Double check that the parameters you are passing in are correct and that the return values are being handled properly. If you notice undocumented patterns in the ways the interface is currently being used, do your best to strictly follow those patterns.

Be extremely careful with any code that touches the exports from a given file. If you are removing exports be sure it won't impact any existing code.

Be extremely cautious taking actions around api endpoints, database queries, or function calls. Any integration point like this should only be altered if absolutely required by the spec. And in those cases, do the minimal changes necessary. These parts of the system are the most fragile and the most likely to break. For example, if the task calls for changing an endpoint from processing multiple tasks to a single task then changing the params of the endpoint from 'tasks' to 'task' is a good change. However, changing all of the endpoints to use a different method of authentication is not a good change.

Be cautious when editing function arguments and parameters. Make sure the function signature and all callers of the function are updated. Only update parameters when it is necessary to fix the issue at hand. For example, if you change a function from processing a single task to multiple tasks then its okay to change the function signature to accept an array of tasks, and make sure to update all callers of the function to pass an array instead of a single task. However, it would not be okay to change the parameters of the function to accept a single object that contains all of the parameters that were previously passed in separately. It would also not be okay to remove a few arguments that were previously passed into a function, unless you had just previously updated the function to work without those arguments.

Make sure any comments you add are not too tied to the task at hand and are generally useful. We don't have to explain obvious code, but we should explain thinking behind complex code or decisions that may not be immediately obvious. For example, a comment that references the spec for this task, or saying that "now we pass in an array instead of a single object" would not be useful. But a comment saying "This is a workaround for a bug in the third-party library" would be useful.

Do NOT remove or change code that is seemingly unrelated to the task at hand. It's very likely you may be accidentally breaking something in the codebase. If that needs to be changed there will be a separate task asking you to do so. For now, focus only on the task at hand.

Below is a repository-specific style guide. Follow the style guide when writing new code:
\`\`\`markdown
${styleGuide}
\`\`\`

The engineering spec is below:
\`\`\`json
${JSON.stringify(spec)}
\`\`\``;};

module.exports = { editCode, tryToEditCode };