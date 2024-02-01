const mongoose = require('mongoose');

// mongoose object representing a file with a path and a hash of the file's contents
const fileSchema = new mongoose.Schema({
  path: String,
  hash: String,
  repoName: String
}, { timestamps: true });

fileSchema.index({ repoName: 1, path: 1 }, { unique: true });

const FileModel = mongoose.model('File', fileSchema);

module.exports = FileModel;