const FileModel = require('../../db/fileModel');
const CodeModel = require('../../db/codeModel');
const Traverser = require('../../summary/parser/traverser');
const CodeChunker = require('./codeChunker');
const { createEmbedding } = require('./embedder');
const { hashText } = require('../../../utils');

async function updateRepoEmbeddings(repoName) {
  const traverser = await Traverser.Create(repoName);
  const chunker = new CodeChunker();

  const fileVisitor = async (file) => {
    if (!file.endsWith('.js')) return;

    const contents = await traverser.container.executeCommand(`cat ${file}`);
    const hash = hashText(contents);
    const res = await findAndMaybeUpdateOrInsertFileModel(file, repoName, hash);
    if (!res.hashMatched) {
      // Embed each top level code chunk & update db if it needs updating
      const chunks = chunker.chunk(contents);
      const fileName = file.split('/').pop();
      for (const chunk of chunks) {
        const hash = hashText(chunk.text);
        const embedding = await createEmbedding(fileName + ' ' + chunk.text);
        await CodeModel.findOneAndUpdate({ hash, repoName, filePath: file, type: chunk.type }, { hash, embedding, filePath: file, type: chunk.type, repoName }, { upsert: true });
      }
    }
  };
  
  const directoryVisitor = async () => {
    // do nothing, the traverser already enters every directory and runs the file visitor.
  };
 
  await traverser.traverse('.', fileVisitor, directoryVisitor);
  await traverser.destroy();
}

const findAndMaybeUpdateOrInsertFileModel = async (path, repoName, hash) => {
  // Step 1: Try to find the document
  const existingDoc = await FileModel.findOne({ path, repoName });
  
  let operationResult = {
    found: false,
    hashMatched: false,
    updated: false,
    inserted: false
  };
  
  if (existingDoc) {
    operationResult.found = true;
    // Check if the hash matches
    if (existingDoc.hash === hash) {
      operationResult.hashMatched = true;
    } else {
      // Step 2: Hash doesn't match, so update the document
      await FileModel.updateOne({ _id: existingDoc._id }, { $set: { hash } });
      operationResult.updated = true;
    }
  } else {
    // Document not found, insert a new one
    await FileModel.create({ path, repoName, hash });
    operationResult.inserted = true;
  }
  return operationResult;
};

module.exports = { updateRepoEmbeddings };