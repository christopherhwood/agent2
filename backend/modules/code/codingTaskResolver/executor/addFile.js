const { queryLlmWithJsonCheck } = require('../../../../llmService');
const { executeCommand } = require('../../../../dockerOperations');
const { createEmbedding } = require('../../../search/ingestion/embedder');
const { selectRelatedCode } = require('../../../search/output/searchCode');

async function addFile(filePath, spec, styleGuide, repoName) {
  if (!filePath.startsWith('./')) {
    filePath = `./${filePath}`;
  }

  const specEmbedding = await createEmbedding(spec);
  const relevantSnippets = await selectRelatedCode(repoName, specEmbedding, [filePath]);

  const edit = await queryLlmWithJsonCheck([{role: 'system', content: createAddFileSystemPrompt(styleGuide)}, {role: 'user', content: query(spec, relevantSnippets, filePath)}], validateAddFile);
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

const query = (spec, relevantSnippets, filePath) => {
  return `Write the code for the new file at ${filePath}. Use the json format {code: ''} to return the code.
  
  The engineering spec for this task is:
  \`\`\`markdown
  ${spec}
  \`\`\`
  
  Potentially relevant snippets from the repository are:
  \`\`\`json
  ${JSON.stringify(relevantSnippets)}
  \`\`\``;
};

const createAddFileSystemPrompt = (styleGuide) => {return `You are a senior software engineer working on a programming task. You are provided a file path identifying the file that we are adding, and an engineering spec for a task. Your job is to write the javascript code for the new file. You will return it in json format: \`{ code: '' }\`. The code you write will be copied into the new file as written, including any comments, verbatim. Do not include anything you wouldn't want to appear in the committed code. Your code should be lean and concise.

Be careful when integrating with existing code. Double check that the parameters you are passing in are correct and that the return values are being handled properly.

Only write code you are confident about. **VERY IMPORTANT:** Do NOT assume the existence of modules, files, or properties on objects (not even the id property)! Our number one priority is to write code that will run and not crash. In the case of adding validations, it's better to add less and be correct than to add more and be incorrect.

When writing imports, follow the existing import syntax (es6, commonjs, etc). When doing dynamic imports in commonjs, try to always add them at the top level of the file unless you have a very good reason for doing otherwise. Try to avoid dynamic imports in es6 unless you have a very good reason for doing otherwise. Following this instruction will make it easier to understand the dependencies of the file and make it easier to statically analyze the code.

Make sure any comments you add are not too tied to the task at hand and are generally useful. We don't have to explain obvious code, but we should explain thinking behind complex code or decisions that may not be immediately obvious. For example, a comment that references the spec for this task, or saying that "now we pass in an array instead of a single object" would not be useful. But a comment saying "This is a workaround for a bug in the third-party library" would be useful.

You are given the following style guide for this repository. Use it as a reference when writing your code:
\`\`\`markdown
${styleGuide}
\`\`\``;};

module.exports = { addFile };