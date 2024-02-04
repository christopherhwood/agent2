const { v4: uuidv4 } = require('uuid');
const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { Container, executeCommand } = require('../../../../dockerOperations');
const { createEmbedding } = require('../../../search/ingestion/embedder');
const { selectRelatedCode } = require('../../../search/output/searchCode');
const { warnAboutInvalidFunctionCalls } = require('../analyzer/warnings/updateFunctionCalls');

async function editCode(filePath, spec, repoName) {
  if (!filePath.startsWith('./')) {
    filePath = `./${filePath}`;
  }
  await editCodeLoop(filePath, spec, [], repoName);
}

async function editCodeLoop(filePath, spec, messages, repoName, triesRemaining = 3) {
  const specEmbedding = await createEmbedding(spec);
  const relevantSnippets = await selectRelatedCode(repoName, specEmbedding, [filePath]);
  const res = await sendEditCodeRequest(filePath, spec, relevantSnippets, messages, repoName);
  const edits = res.edits;
  for (const edit of edits) {
    try {
      await tryToEditCode(filePath, edit, repoName);
    } catch (err) {
      edit.error = err.message;
    }
  }

  const errorEdits = edits.filter(edit => edit.error);
  if (errorEdits.length > 0) {
    if (triesRemaining > 0) {
      await editCodeLoop(filePath, spec, [...messages, {role: 'assistant', content: JSON.stringify(res)}, {role: 'user', content: fixErrorQuery(edits)}], repoName, triesRemaining - 1);
    } else {
      console.log('Unfixed error edits:\n', errorEdits);
    }
  }
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

async function sendEditCodeRequest(filePath, spec, relevantSnippets, messages, repoName) {
  const editQuery = await query(filePath, repoName);
  const res = await queryLlmWithJsonCheck([{role: 'system', content: createEditCodeSystemPrompt(spec, relevantSnippets)}, {role: 'user', content: editQuery}, ...messages], validateEditCode);
  return res;
}

async function tryToEditCode(filePath, edit, repoName) {
  const uniqueId = uuidv4().toString();
  if (edit.originalCode && edit.newCode) {
    const originalCode = edit.originalCode;
    const newCode = edit.newCode;
    // // Replace line breaks in original code with \n
    // const originalCode = edit.originalCode.replace(/\\n/g, '\n');
    // // Replace line breaks in new code with \n
    // const newCode = edit.newCode.replace(/\\n/g, '\n');

    // Create a container
    const container = await Container.Create(repoName);

    // Echo the code to a temp file in the container
    await container.executeCommand(`cat << 'EOF' > /usr/src/temp-${uniqueId}\n${newCode}\nEOF`);

    await container.executeCommand(`cat << 'EOF' > /usr/src/original-${uniqueId}\n${originalCode}\nEOF`);

    // Insert the code into the specified file using the /usr/bin/insertCode.js script
    let output = await container.executeCommand(`/usr/bin/replaceCode.js ${filePath} /usr/src/original-${uniqueId} /usr/src/temp-${uniqueId}`);
    
    // Destroy the container
    const fileContents = await container.executeCommand(`cat ${filePath}`);
    try {
      if (output && output.trim().length > 0) {
        if (output.includes('Error:')) {
          output = '# Error\n' + output;
          output += `\n\n**Original File Contents at ${filePath}:**\n\`\`\`\n` + fileContents + '\n```'; 
          throw new Error(output);
        }
      } else {
        output = 'File edited successfully.';
        const functionCallWarning = await warnAboutInvalidFunctionCalls(originalCode, newCode, repoName);
        if (functionCallWarning) {
          output += '\n\n**WARNING:**\n' + functionCallWarning;
        }
      }
    } finally {
      await container.destroy();
    }
    return output;
  }
  throw new Error('Error: File not edited - invalid contents');
}

const validateEditCode = (response) => {
  if (!response.edits) {
    throw new Error('Response must contain an "edits" field');
  }
  if (!Array.isArray(response.edits)) {
    throw new Error('Edits must be an array');
  }
  for (const edit of response.edits) {
    if (!edit.originalCode || (!edit.newCode && typeof edit.newCode !== 'string')) {
      throw new Error('Each edit must contain an "originalCode" and "newCode" field');
    }
  }
  return response;
};

const query = async (filePath, repoName) => {
  const fileContents = await executeCommand(`cat ${filePath}`, repoName);
  return `Write the new code and the code to replace for the file at ${filePath}. Use the json format {edits: [{originalCode: '', newCode: ''}]} to return the code.
  
  The existing code at ${filePath} is:
  \`\`\`javascript
  ${fileContents}
  \`\`\``;
};

const createEditCodeSystemPrompt = (spec, relevantSnippets) => {return `You are a senior software engineer working on a programming task. You are provided a file path identifying the file that we are editing, and an engineering spec for a task.

Your job is to write the javascript code for the new file. Your output will be structured as follows, detailing the edits you propose:
\`\`\`json
{
  "edits": [
    {
      "id": "a unique id",
      "thoughts": "Your thoughts on the edit",
      "originalCode": "Exact subsection of the original code to be replaced, including comments and spacing. This must match _exactly_ the code in the file. If it does not, the command will fail. If the code contains comments, the comments must match _exactly_ what is in the source file. Otherwise, the command will fail. The original code will be removed in its entirety and replaced with the contents of newCode. Ensure you are only deleting the code that needs to be replaced. If you delete too much, you will break the codebase. If you delete too little, you will not fix the issue. Be careful.",
      "newCode": "The revised code snippet that corrects the identified issue. This will replace the originalCode exactly as written, including any comments, verbatim."
    },
    // Additional edits as necessary
  ]
}
\`\`\`

The newCode will replace the originalCode, meaning that the originalCode will be completely removed and the newCode will be copied directly as written, including any comments, verbatim. Be careful about what code is deleted. Only make changes as directed in the spec, do not go off script. Do not include anything in the newCode you wouldn't want to appear in the committed code.

Only write code you are confident about. Be especially careful about assuming the properties of objects unless you know the properties for sure. In the case of adding validations, it's better to add less and be correct than to add more and be incorrect.

When writing imports, follow the existing import syntax (es6, commonjs, etc). When doing dynamic imports in commonjs, try to always add them at the top level of the file unless you have a very good reason for doing otherwise. Try to avoid dynamic imports in es6 unless you have a very good reason for doing otherwise. Following this instruction will make it easier to understand the dependencies of the file and make it easier to statically analyze the code.

Be wary when editing functions that are currently in use. If you change the function signature, you will need to update all calls to that function. If you change the function body, you will need to ensure that the new code does not break any existing functionality. It may be easier sometimes to create a new function that accomplishes your goals rather than trying to edit an existing function. However, bare in mind that this will increase the amount of code in the codebase and the maintenance burden.

Be careful when integrating with existing code. Double check that the parameters you are passing in are correct and that the return values are being handled properly. If you notice undocumented patterns in the ways the interface is currently being used, do your best to strictly follow those patterns.

Be extremely careful with any code that touches the exports from a given file. If you are removing exports be sure it won't impact any existing code.

Be extremely cautious taking actions around api endpoints, database queries, or function calls. Any integration point like this should only be altered if absolutely required by the spec. And in those cases, do the minimal changes necessary. These parts of the system are the most fragile and the most likely to break. For example, if the task calls for changing an endpoint from processing multiple tasks to a single task then changing the params of the endpoint from 'tasks' to 'task' is a good change. However, changing all of the endpoints to use a different method of authentication is not a good change.

Be cautious when editing function arguments and parameters. Make sure the function signature and all callers of the function are updated. Only update parameters when it is necessary to fix the issue at hand. For example, if you change a function from processing a single task to multiple tasks then its okay to change the function signature to accept an array of tasks, and make sure to update all callers of the function to pass an array instead of a single task. However, it would not be okay to change the parameters of the function to accept a single object that contains all of the parameters that were previously passed in separately. It would also not be okay to remove a few arguments that were previously passed into a function, unless you had just previously updated the function to work without those arguments.

Make sure any comments you add are not too tied to the task at hand and are generally useful. We don't have to explain obvious code, but we should explain thinking behind complex code or decisions that may not be immediately obvious. For example, a comment that references the spec for this task, or saying that "now we pass in an array instead of a single object" would not be useful. But a comment saying "This is a workaround for a bug in the third-party library" would be useful.

Do NOT remove or change code that is seemingly unrelated to the task at hand. It's very likely you may be accidentally breaking something in the codebase. If that needs to be changed there will be a separate task asking you to do so. For now, focus only on the task at hand.

The engineering spec is below:
\`\`\`json
${JSON.stringify(spec)}
\`\`\`

Potentially relevant code snippets:
\`\`\`json
${JSON.stringify(relevantSnippets)}
\`\`\``;};

module.exports = { editCode, tryToEditCode };