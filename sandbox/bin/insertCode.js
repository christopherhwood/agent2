#!/usr/local/bin/node

const fs = require('fs');
const os = require('os');
const pathModule = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);
const [relativePath, line, column, codeFile] = args;

// Resolve the absolute path from the relative path
const absolutePath = pathModule.resolve(process.cwd(), relativePath);

// Convert line and column to numbers
const location = {
  line: parseInt(line, 10),
  column: parseInt(column, 10)
};

// Read the code from the provided code file
const code = fs.readFileSync(codeFile, 'utf8');

// Insert code function
function insertCode(path, location, code) {
  // Read the original file
  const fileContent = fs.readFileSync(path, 'utf8');
  const lines = fileContent.split(os.EOL);

  // Prepare the multi-line code for insertion
  const preparedCode = prepareCodeForInsertion(code, location.column, lines[location.line - 1]);

  // Insert the prepared code into the correct location
  lines.splice(location.line - 1, 1, preparedCode);

  // Write the modified content back to the file
  fs.writeFileSync(path, lines.join(os.EOL));

  // Log the modified content
  console.log(lines.join(os.EOL));
}

// Prepare code for insertion
function prepareCodeForInsertion(code, column, originalLine) {
  // Split the original line at the specified column
  const lineStart = originalLine.substring(0, column - 1);
  const lineEnd = originalLine.substring(column - 1);

  // Add the new code at the specified column
  const modifiedLine = lineStart + code;

  // Return the modified line followed by the original line end
  return modifiedLine + os.EOL + lineEnd;
}

try {
  // Execute the insertCode function
  insertCode(absolutePath, location, code);
} catch (err) {
  console.error('Error inserting code:', err);
}
