#!/usr/local/bin/node

const fs = require('fs');
const os = require('os');
const pathModule = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);
const [relativePath, line, column, length] = args;

// Resolve the absolute path from the relative path
const absolutePath = pathModule.resolve(process.cwd(), relativePath);

// Convert line, column, and length to numbers
const location = {
  line: parseInt(line, 10),
  column: parseInt(column, 10),
  length: parseInt(length, 10)
};

// Delete code function
function deleteCode(path, location) {
  // Read the original file
  const fileContent = fs.readFileSync(path, 'utf8');
  const lines = fileContent.split(os.EOL);

  // Prepare for deletion of the code
  const modifiedContent = prepareForCodeDeletion(location, lines);

  // Write the modified content back to the file
  fs.writeFileSync(path, modifiedContent.join(os.EOL));

  // Log the modified content
  console.log(modifiedContent.join(os.EOL));
}

// Prepare for deletion of the code
function prepareForCodeDeletion(location, lines) {
  const startLineIndex = location.line - 1;

  // Remove the specified range of lines
  lines.splice(startLineIndex, location.length);

  return lines;
}

try {
  // Execute the deleteCode function
  deleteCode(absolutePath, location);
} catch (err) {
  console.error('Error deleting code:', err);
}
