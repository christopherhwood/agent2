const mongoose = require('mongoose');

// mongoose object representing a snippet of code with an id, name, type, filePath, repoName, embedding, and hash of the code's contents
const codeSchema = new mongoose.Schema({
  type: String,
  filePath: String,
  repoName: String,
  embedding: [Number],
  hash: String
}, { timestamps: true });

codeSchema.index({ repoName: 1, filePath: 1 });

const CodeModel = mongoose.model('Code', codeSchema);

module.exports = CodeModel;