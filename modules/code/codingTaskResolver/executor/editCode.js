const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { Container, executeCommand } = require('../../../../dockerOperations');
const { v4: uuidv4 } = require('uuid');

async function editCode(filePath, spec, repoName) {
  await editCodeLoop(filePath, spec, [], repoName);
}

async function editCodeLoop(filePath, spec, messages, repoName, triesRemaining = 3) {
  const edits = await sendEditCodeRequest(filePath, spec, messages, repoName);
  for (const edit of edits) {
    try {
      return await tryToEditCode(filePath, edit, repoName);
    } catch (err) {
      edit.error = err.message;
    }
  }

  const errorEdits = edits.filter(edit => edit.error);
  if (errorEdits.length > 0) {
    if (triesRemaining > 0) {
      return await editCodeLoop(filePath, spec, [...messages, {role: 'assistant', content: JSON.stringify(edits)}, {role: 'user', content: `A few of your edits had errors. Please correct them.\n\`\`\`json\n${edits}\n\`\`\``}], repoName, triesRemaining - 1);
    } else {
      console.log('Unfixed error edits:\n', errorEdits);
    }
  }
}

async function sendEditCodeRequest(filePath, spec, messages, repoName) {
  const editQuery = await query(filePath, repoName);
  const edit = await queryLlmWithJsonCheck([{role: 'system', content: createEditCodeSystemPrompt(spec)}, {role: 'user', content: editQuery}, ...messages], validateEditCode);
  return edit;
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
      if (output && output.length > 0) {
        if (output.includes('Error:')) {
          output = '# Error\n' + output;
          output += `\n\n**Original File Contents at ${filePath}:**\n\`\`\`\n` + fileContents + '\n```'; 
          if (originalCode.includes('//') || originalCode.includes('/*')) {
            output += '\n\n**IMPORTANT**: The code you provided to be replaced did not match. The snippet contains comments. Please make sure the comments match _exactly_ what is in the source file. Otherwise, the command will fail.';
          }
          throw new Error(output);
        }
      } else {
        output = '# Success\nThe file\'s contents are:';
        output += `\n\`\`\`\n${fileContents}\n\`\`\``;
      }
    } finally {
      await container.destroy();
    }
    return 'File edited successfully';
  }
  throw new Error('Error: File not edited - invalid contents');
}

const validateEditCode = (response) => {
  if (!response || !response.newCode || !response.originalCode) {
    throw new Error('Response must be an object with newCode and originalCode properties');
  }
  return response;
};

const query = async (filePath, repoName) => {
  const fileContents = await executeCommand(`cat ${filePath}`, repoName);
  return `Write the new code and the code to replace for the file at ${filePath}. Use the json format {originalCode: '', newCode: ''} to return the code.
  
  The existing code at ${filePath} is:
  \`\`\`javascript
  ${fileContents}
  \`\`\``;
};

const createEditCodeSystemPrompt = (spec) => {return `You are a senior software engineer working on a programming task. You are provided a file path identifying the file that we are editing, and an engineering spec for a task.

Your job is to write the javascript code for the new file. Your output will be structured as follows, detailing the edits you propose:
\`\`\`json
{
  "edits": [
    {
      "originalCode": "Exact subsection of the original code to be replaced",
      "newCode": "The revised code snippet that corrects the identified issue"
    },
    // Additional edits as necessary
  ]
}
\`\`\`

The newCode will replace the originalCode, meaning that the originalCode will be completely removed and the newCode will be copied directly as written, including any comments, verbatim. Do not include anything you wouldn't want to appear in the committed code.

Be wary when editing functions that are currently in use. If you change the function signature, you will need to update all calls to that function. If you change the function body, you will need to ensure that the new code does not break any existing functionality. It may be easier sometimes to create a new function that accomplishes your goals rather than trying to edit an existing function. However, bare in mind that this will increase the amount of code in the codebase and the maintenance burden.

Be careful when integrating with existing code. Double check that the parameters you are passing in are correct and that the return values are being handled properly. If you notice undocumented patterns in the ways the interface is currently being used, do your best to strictly follow those patterns.

Be extremely careful with any code that touches the exports from a given file. If you are removing exports be sure it won't impact any existing code.

Do NOT remove or change code outside of the code shared in the selected context, it is more than likely being used in a way that you are not aware of and your changes will break the codebase.

The engineering spec is below:
\`\`\`json
${JSON.stringify(spec)}
\`\`\``;};

module.exports = { editCode, tryToEditCode };