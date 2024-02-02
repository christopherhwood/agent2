const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { executeCommand } = require('../../../../dockerOperations');
const { tryToEditCode } = require('./editCode');

async function cleanUpCode(filePath, repoName) {
  await cleanUpCodeLoop(filePath, repoName, []);
}

async function cleanUpCodeLoop(filePath, repoName, messages, triesRemaining = 3) {
  const lintRes = await lint(filePath, repoName);
  const res = await queryLlmWithJsonCheck([{role: 'system', content: SystemPrompt}, {role: 'user', content: await query(filePath, lintRes, repoName)}], validateCleanUpCode);
  const edits = res.edits;

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
      return await cleanUpCodeLoop(filePath, repoName, [...messages, {role: 'assistant', content: JSON.stringify(edits)}, {role: 'user', content: fixErrorQuery(edits)}], repoName, triesRemaining - 1);
    } else {
      console.log('Unfixed error edits:\n', errorEdits);
    }
  }
}

async function lint(filePath, repoName) {
  return await executeCommand(`npm run lint -- ${filePath}`, repoName);
}

const fixErrorQuery = (edits) => {
  let query = 'One or more of your edits contained errors. Generally this is because the originalCode does not match exactly the current file contents. Be sure the originalCode matches line for line with the current file contents, including any spacing and comments. Pay close attention to the error message and resubmit a correct edit for the following edits:';

  for (const edit of edits) {
    if (edit.error) {
      query += `\n\n# Edit ${edit.id}\n${edit.error}`;
    }
  }
  return query;
};

const validateCleanUpCode = (response) => {
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

const query = async (filePath, lint, repoName) => {
  const diff = await executeCommand(`git diff --unified="$(wc -l < ${filePath})" ${filePath}`, repoName);
  return `**Diff:**\n\`\`\`\n${diff}\n\`\`\`\n**Lint:**\n\`\`\`\n${lint}\n\`\`\``;
};

const SystemPrompt = `You are a specialized JavaScript code cleanup system, designed to enhance the quality of JavaScript code files by focusing on recent uncommitted changes. Your primary function is to analyze the git diff and lint of the current file, identifying and rectifying any glaring errors. Changes made in this step should be minimal but requisite and only focused around the already changed lines. Your goal is to ensure that the commit is clean, focused, and free from obvious mistakes, contributing to a clear and meaningful commit history.

Upon receiving the git diff and lint of a JavaScript file, you will:

1. Analyze the current file's diff.
2. Review the current file's lint results.
3. Identify any glaring errors in the code that are a direct result of the recent changes. This includes syntax errors, duplicated code sections, comments that don't make sense, and similar issues.
4. Propose corrections that specifically address these errors without modifying the business logic of the code. The goal is to prevent us from introducing new bugs during this phase.
5. Ensure that the \`originalCode\` specified for replacement matches exactly a subsection of the current code. That means character by character identical, otherwise the edit will fail.
6. Provide \`newCode\` as a ready-to-commit replacement for the \`originalCode\`. The new code should be complete, correctly formatted, and adhere to JavaScript best practices.

Your output will be structured as follows, detailing the edits you propose:
\`\`\`json
{
  "edits": [
    {
      "id": "a unique id",
      "originalCode": "Exact subsection of the original code to be replaced, including comments and spacing. This must match _exactly_ the code in the file. If it does not, the command will fail. If the code contains comments, the comments must match _exactly_ what is in the source file. Otherwise, the command will fail.",
      "newCode": "The revised code snippet that corrects the identified issue. This will replace the originalCode exactly as written, including any comments, verbatim."
    },
    // Additional edits as necessary, focused only on correcting glaring errors.
  ]
}
\`\`\`

Make sure any comments you add are not too tied to the task at hand and are generally useful. We don't have to explain obvious code, but we should explain thinking behind complex code or decisions that may not be immediately obvious.

In making these edits, your aim is to contribute to a commit that not only resolves obvious errors related to the recent changes but also enhances the overall quality of the changes being committed, ensuring that the codebase remains robust, reliable, and easy to maintain.`;

module.exports = { cleanUpCode };