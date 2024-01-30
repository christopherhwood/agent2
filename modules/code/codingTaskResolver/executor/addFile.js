const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { executeCommand } = require('../../../../dockerOperations');

async function addFile(filePath, spec, repoName) {
  const edit = await queryLlmWithJsonCheck([{role: 'system', content: createAddFileSystemPrompt(spec)}, {role: 'user', content: query(filePath)}], validateAddFile);
  if (edit.code) {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir.length > 0) {
      await executeCommand(`mkdir -p ${dir}`, repoName);
    }
    await executeCommand(`cat << 'EOF' > ${filePath}\n${edit.code}\nEOF`, repoName);
    return 'File added successfully';
  }
  return 'Error: File not added - invalid contents';
}

const validateAddFile = (response) => {
  if (!response || !response.code) {
    throw new Error('Response must be an object with a code property');
  }
  return response;
};

const query = (filePath) => {
  return `Write the code for the new file at ${filePath}. Use the json format {code: ''} to return the code.`;
};

const createAddFileSystemPrompt = (spec) => {return `You are a senior software engineer working on a programming task. You are provided a file path identifying the file that we are adding, and an engineering spec for a task. Your job is to write the javascript code for the new file. You will return it in json format: \`{ code: '' }\`. The code you write will be copied into the new file as written, including any comments, verbatim. Do not include anything you wouldn't want to appear in the committed code.

Be careful when integrating with existing code. Double check that the parameters you are passing in are correct and that the return values are being handled properly.

The engineering spec is below:
\`\`\`json
${JSON.stringify(spec)}
\`\`\``;};

module.exports = { addFile };