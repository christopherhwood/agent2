#!/usr/local/bin/node

const fs = require('fs');
const pathModule = require('path');

// Parse command-line arguments
const args = process.argv.slice(2);
const [relativePath, originalSnippetPath, newCodeFile] = args;

// Resolve the absolute path from the relative path
const absolutePath = pathModule.resolve(process.cwd(), relativePath);

// Read the original and new code snippets
const originalSnippet = fs.readFileSync(originalSnippetPath, 'utf8').trim();
const newCode = fs.readFileSync(newCodeFile, 'utf8').trim();

// Replace code function
function replaceCode(path, originalSnippet, newCode) {
  // Read the original file
  const fileContent = fs.readFileSync(path, 'utf8');
  
  // Check if the original snippet exists in the file
  if (!fileContent.includes(originalSnippet)) {
    console.error('Error: Original code snippet does not exist.');
    process.exit(1);
  }

  // Replace the original snippet with the new code
  const updatedContent = fileContent.replace(originalSnippet, newCode);

  // Write the modified content back to the file
  fs.writeFileSync(path, updatedContent);

  // Log the modified content
  console.log(updatedContent);
}

try {
  // Execute the replaceCode function
  replaceCode(absolutePath, originalSnippet, newCode);
} catch (err) {
  console.error('Error replacing code:', err);
}
