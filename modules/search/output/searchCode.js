const CodeModel = require('../../db/codeModel');
const CodeChunker = require('../ingestion/codeChunker');
const { executeCommand } = require('../../../dockerOperations');
const { hashText } = require('../../../utils');

// Returns a {filePath: [context]} map of related code snippets
async function selectRelatedCode(repoName, embedding, excludedFiles=[], limit = 10) {
  if (!embedding || !repoName) throw new Error('Invalid input', repoName, embedding);
  let filter = excludedFiles.length > 0 ? { '$and': [{ 'repoName': {'$eq': repoName} }, { 'filePath': {'$nin': excludedFiles}}] } : { 'repoName': {'$eq': repoName} };
  const res = await CodeModel.aggregate([
    {
      $vectorSearch: {
        index: 'code_embedding_vector_index',
        path: 'embedding',
        queryVector: embedding,
        numCandidates: limit * 10,
        limit: limit,
        filter: filter
      }
    },
    {
      $project: {
        _id: 0,
        hash: 1,
        type: 1,
        filePath: 1
      }
    }
  ]);
  console.log('res', res);

  const chunker = new CodeChunker();
  let fileContextMap = {};
  let fileContentsMap = {};
  for (const code of res) {
    let contents;
    if (code.filePath in fileContentsMap) {
      contents = fileContentsMap[code.filePath];
    } else {
      // Retrieve code snippet from file in container
      contents = await executeCommand(`cat ${code.filePath}`, repoName);
      fileContentsMap[code.filePath] = contents;
    }
    // Parse contents to find snippet of code that matches the type and hash
    const chunks = chunker.chunk(contents);
    for (const chunk of chunks) {
      if (chunk.type !== code.type) continue;
      console.log('node\n```' + chunk.text + '```');
      if (hashText(chunk.text) === code.hash) {
        console.log('hash matched!');
        if (code.filePath in fileContextMap) {
          fileContextMap[code.filePath].push(chunk.text);
        } else {
          fileContextMap[code.filePath] = [chunk.text];
        }
        break;
      }
    }
  }
  return fileContextMap; 
}

module.exports = { selectRelatedCode };