const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { executeCommand } = require('../../../../dockerOperations');
const { tryToEditCode } = require('./editCode');

async function cleanUpCode(filePath, repoName) {
  const edits = await queryLlmWithJsonCheck([{role: 'system', content: SystemPrompt}, {role: 'user', content: await query(filePath, repoName)}], validateCleanUpCode);

  for (const edit of edits) {
    try {
      return await tryToEditCode(filePath, edit, repoName);
    } catch (err) {
      edit.error = err.message;
    }
  }

  const errorEdits = edits.filter(edit => edit.error);
  if (errorEdits.length > 0) {
    console.log('Unfixed error edits:\n', errorEdits);
  }
}

const validateCleanUpCode = (response) => {
  if (!response.edits) {
    throw new Error('Response must contain an "edits" field');
  }
  if (!Array.isArray(response.edits)) {
    throw new Error('Edits must be an array');
  }
  for (const edit of response.edits) {
    if (!edit.originalCode || !edit.newCode) {
      throw new Error('Each edit must contain an "originalCode" and "newCode" field');
    }
  }
  return response;
};

const query = async (filePath, repoName) => {
  const contents = await executeCommand(`cat ${filePath}`, repoName);
  return `\`\`\`json\n${contents}\n\`\`\``;
};

const SystemPrompt = `You are a JavaScript code cleanup system designed to streamline and enhance the quality of JavaScript code files. Your primary function is to meticulously scan the contents of a provided code file, identify areas that require refinement, and propose specific edits to improve the code. Your focus areas include locating and correcting common errors such as duplicated lines of code, outdated or irrelevant comments, and other clear mistakes that detract from the code's readability, maintainability, or performance.

Upon receiving the contents of a JavaScript file, you will:

1. Analyze the code to identify glaring errors that need to be addressed. This includes duplicated code sections, comments that are misleading or no longer applicable, syntax errors, and other similar issues.
2. For each identified issue, carefully craft a correction that resolves the problem. This involves writing new code snippets or comments that are accurate, relevant, and optimized.
3. Ensure that the \`originalCode\` you specify for replacement matches exactly a subsection of the provided code. This exact match is crucial for precise editing and to avoid unintentional modifications.
4. Provide the \`newCode\` as a ready-to-commit replacement for the \`originalCode\`. This new code must be complete, correctly formatted, and adherent to JavaScript best practices, ensuring that it can be seamlessly integrated into the file.

Your output will be structured as follows, detailing the edits you propose:
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

In performing these edits, you aim to not only correct obvious errors but also to enhance the overall quality of the code file, making it cleaner, more efficient, and easier to understand. However, you should not be changing the behavior of the code, just cleaning it up. Your contributions are essential for maintaining high standards of code quality and ensuring that the codebase remains robust and reliable.`;

module.exports = { cleanUpCode };