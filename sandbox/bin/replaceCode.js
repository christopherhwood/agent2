#!/usr/local/bin/node

const fs = require('fs');
const os = require('os');
const pathModule = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);
const [relativePath, line, column, length, codeFile] = args;

// Resolve the absolute path from the relative path
const absolutePath = pathModule.resolve(process.cwd(), relativePath);

// Convert line, column, and length to numbers
const location = {
  line: parseInt(line, 10),
  column: parseInt(column, 10),
  length: parseInt(length, 10)
};

// Read the new code from the provided code file
const newCode = fs.readFileSync(codeFile, 'utf8');

// Replace code function
function replaceCode(path, location, newCode) {
  // Read the original file
  const fileContent = fs.readFileSync(path, 'utf8');
  const lines = fileContent.split(os.EOL);

  // Prepare the new code for replacement
  const preparedNewCode = prepareCodeForReplacement(newCode, location, lines);

  // Write the modified content back to the file
  fs.writeFileSync(path, preparedNewCode.join(os.EOL));

  // Log the modified content
  console.log(preparedNewCode.join(os.EOL));
}

// Prepare code for replacement
function prepareCodeForReplacement(newCode, location, lines) {
  const startLineIndex = location.line - 1;
  const endLineIndex = startLineIndex + location.length;
  
  // Extract the portion of the file to be replaced
  const before = lines.slice(0, startLineIndex);
  const after = lines.slice(endLineIndex);

  // Split the new code into lines
  const newCodeLines = newCode.split(os.EOL);

  // Combine the file parts with the new code
  return [...before, ...newCodeLines, ...after];
}

try {
  // Execute the replaceCode function
  replaceCode(absolutePath, location, newCode);
} catch (err) {
  console.error('Error replacing code:', err);
}
