const { createEmbedding } = require('../ingestion/embedder');
const { selectRelatedCode } = require('./searchCode');
const { rankCode } = require('./rankCode');
const { extractKeyWords } = require('./extractKeyWords');

async function pickCodeContext(task, problemStatement, repoName, excludedFiles=[], debug=false) {
  const keywords = await extractKeyWords(task);
  const taskEmbedding = await createEmbedding(keywords.join(' '));
  const selectedSnippets = await selectRelatedCode(repoName, taskEmbedding, excludedFiles);
  if (debug) {
    console.log('selectedSnippets', selectedSnippets);
  }
  const rankedSnippets = await rankCode(task, problemStatement, selectedSnippets);
  // Merge into a [{file: '', contents: ''}] array where multiple contents are combined by "//...\n"
  let context = [];
  let fileContextMap = {};
  for (const snippet of rankedSnippets) {
    if (snippet.file in fileContextMap) {
      fileContextMap[snippet.file].push(snippet.codeSnippet);
    }
    else {
      fileContextMap[snippet.file] = [snippet.codeSnippet];
    }
  }
  for (const file in fileContextMap) {
    context.push({ file, contents: fileContextMap[file].join('//...\n') });
  }
  return context;
}

module.exports = { pickCodeContext };