#!/usr/local/bin/node

const fs = require('fs');
const pathModule = require('path');
const diff = require('diff');

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
    console.error('Error: Original code snippet does not exist. ');
    compareSnippets(originalSnippet, fileContent);
    process.exit(1);
  }

  // Replace the original snippet with the new code
  const updatedContent = fileContent.replace(originalSnippet, newCode);

  // Write the modified content back to the file
  fs.writeFileSync(path, updatedContent);
}

// For error handling: 
// Function to find the first full word in the original snippet
function findFirstWord(snippet) {
  const match = snippet.match(/^\S+/);
  return match ? match[0] : null;
}

// Function to find the best matching section in the file content
function findBestMatch(originalSnippet, fileContent) {
  const firstWord = findFirstWord(originalSnippet);
  if (!firstWord) {
    return { start: -1, end: -1, similarity: 0 };
  }

  let bestMatch = { start: -1, end: -1, similarity: 0 };
  let startIndex = fileContent.indexOf(firstWord);

  while (startIndex !== -1) {
    let endIndex = startIndex + originalSnippet.length;
    let snippetToCompare = fileContent.substring(startIndex, endIndex);

    let matchCount = 0;
    for (let i = 0; i < originalSnippet.length; i++) {
      if (snippetToCompare[i] === originalSnippet[i]) {
        matchCount++;
      }
    }

    let similarity = matchCount / originalSnippet.length;
    if (similarity > bestMatch.similarity) {
      bestMatch = { start: startIndex, end: endIndex, similarity: similarity };
    }

    // Search for the next occurrence of the first word
    startIndex = fileContent.indexOf(firstWord, startIndex + 1);
  }

  return bestMatch;
}

// Compare snippets function with context for mismatch
function compareSnippets(originalSnippet, fileContent) {
  const bestMatch = findBestMatch(originalSnippet, fileContent);
  if (bestMatch.start === -1) {
    console.error('No similar snippet found in the file content.');
    return;
  }

  const matchedSection = fileContent.substring(bestMatch.start, bestMatch.end);
  let mismatchContent = '';
  let originalContent = '';
  let contextBuffer = '';
  let contextLength = 20;
  let exceededContextWindow = false;

  for (let i = 0; i < originalSnippet.length; i++) {
    if (contextBuffer.length === contextLength) {
      exceededContextWindow = true;
    }

    if (matchedSection.length < i || originalSnippet[i] !== matchedSection[i]) {
      let originalSnippetIndex = i;
      while (originalSnippetIndex < originalSnippet.length && originalSnippetIndex < i + 10) {
        mismatchContent += originalSnippet[originalSnippetIndex];
        originalSnippetIndex++;
      }
      if (originalSnippetIndex < originalSnippet.length) {
        mismatchContent += '...';
      }

      let matchedSectionIndex = i;
      while (matchedSectionIndex < matchedSection.length && matchedSectionIndex < i + 10) {
        originalContent += matchedSection[matchedSectionIndex];
        matchedSectionIndex++;
      }
      if (matchedSectionIndex < matchedSection.length) {
        originalContent += '...';
      }

      if (exceededContextWindow) {
        contextBuffer = '...' + contextBuffer;
      }
      console.error(`Mismatch found. You provided: '${contextBuffer}${mismatchContent}' but the original code is: '${contextBuffer}${originalContent}'`);
      return;
    }
    contextBuffer = (contextBuffer + originalSnippet[i]).slice(-contextLength);
  }
}

try {
  // Execute the replaceCode function
  replaceCode(absolutePath, originalSnippet, newCode);
} catch (err) {
  console.error('Error: Error replacing code:', err);
}
