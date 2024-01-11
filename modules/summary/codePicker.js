const { createContainer, destroyContainer, executeCommand } = require('../../dockerOperations');
const { queryLlmWithJsonCheck } = require('../../llmService');
const { prepareFileSelectionQuery, prepareFileSelectionConfirmationQuery, prepareImportantFunctionQuery, prepareImportantFunctionConfirmationQuery } = require('./llmQueries');
const { FilePickerSystemPrompt, FunctionPickerSystemPrompt } = require('./systemPrompts');

async function pickImportantCodeFromRepoForTask(repoName, taskDescription) {
  // 1. Get directory tree & recent commits
  let fileNames = await selectKeyFiles(repoName, taskDescription);
  console.log('key files:');
  console.log(fileNames);

  let fileCodeMap = await getImportantFunctionsFromFiles(taskDescription, repoName, fileNames.files); 
  console.log('key code:');
  console.log(fileCodeMap);

  let iterations = 0;
  while (iterations < 3) {
    // Confirm the file selection
    const confirmationQuery = prepareFileSelectionConfirmationQuery(taskDescription, context, fileCodeMap);
    const confirmedFileNames = await queryLlmWithJsonCheck([{role: 'system', content: FilePickerSystemPrompt}, {role: 'user', content: confirmationQuery}], validateFileSelectionResponse);

    // Check if any files not included in original selection are now included
    const newFileNameSet = new Set([...confirmedFileNames.files, ...fileNames.files]);
    const oldFileNameSet = new Set(fileNames.files);
    const newFileNames = [...newFileNameSet].filter(fileName => !oldFileNameSet.has(fileName));

    if (newFileNames.length === 0 && newFileNameSet.length === oldFileNameSet.length) {
      break;
    }
    console.log('new files:');
    console.log(newFileNames);

    fileNames = confirmedFileNames;

    // Filter any removed files out of the fileCodeMap
    fileCodeMap = fileCodeMap.filter(file => newFileNameSet.has(file.name));

    // Get important functions for any new files & confirm the important functions
    const newFileCodeMap = await getImportantFunctionsFromFiles(taskDescription, repoName, newFileNames);
    fileCodeMap = fileCodeMap.concat(newFileCodeMap);
    // Filter out files with empty code arrays
    fileCodeMap = fileCodeMap.filter(file => file.code.length > 0);
    iterations++;
  }

  return fileCodeMap;  
}

async function selectKeyFiles(repoName, taskDescription) {
  // 1. Get directory tree & recent commits
  const context = await getInitialContext(repoName); 

  // 2. & 3. Get and fetch investigation suggestions
  const fileSelectionQuery = prepareFileSelectionQuery(taskDescription, context);
  let fileNames = await queryLlmWithJsonCheck([{role: 'system', content: FilePickerSystemPrompt}, {role: 'user', content: fileSelectionQuery}], validateFileSelectionResponse);
  return fileNames;
}

async function getImportantFunctionsFromFiles(taskDescription, repoName, fileNames) {
  // Get file contents & ask LLM to select important sections of contents.
  let fileCodeMap = {};
  for (const fileName of fileNames) {
    const contents = await executeCommand(`cat ${fileName}`, repoName);
    const importantFunctionQuery = prepareImportantFunctionQuery(taskDescription, contents);
    const importantFunctionResponse = await queryLlmWithJsonCheck([{role: 'system', content: FunctionPickerSystemPrompt}, {role: 'user', content: importantFunctionQuery}], validateImportantFunctionResponse);

    // Filter out any hallucincated code
    importantFunctionResponse.code = importantFunctionResponse.code.filter(code => contents.includes(code));

    // confirm important functions
    const importantFunctions = await confirmImportantFunctions(taskDescription, contents, importantFunctionResponse.code);

    // Filter out any hallucincated code
    fileCodeMap[fileName] = importantFunctions.code.filter(code => contents.includes(code));
  }
  return fileCodeMap;
}

async function getInitialContext(repoName) {
  const container = await createContainer(repoName);
  // Update the repo first
  const defaultBranch = await executeCommand('git --no-pager remote show origin | grep "HEAD branch" | cut -d" " -f5', repoName, container);
  await executeCommand(`git --no-pager pull origin ${defaultBranch.trim()}`, repoName, container);

  // Execute commands to get directory tree and recent commits
  const directoryTree = await executeCommand('tree -I "node_modules|.git|package-lock.json"', repoName, container);
  const recentCommits = await executeCommand('git --no-pager log -n 5 --pretty=format:"%h - %an, %ar : %s"', repoName, container);

  await destroyContainer(container);

  return {
    directoryTree,
    recentCommits
  };
}

async function confirmImportantFunctions(taskDescription, contents, importantFunctions) {
  const confirmationQuery = prepareImportantFunctionConfirmationQuery(taskDescription, contents, importantFunctions);
  const confirmationResponse = await queryLlmWithJsonCheck([{role: 'system', content: FunctionPickerSystemPrompt}, {role: 'user', content: confirmationQuery}], validateImportantFunctionResponse);
  return confirmationResponse;
}

function validateFileSelectionResponse(jsonResponse) {
  if (!jsonResponse.files) {
    jsonResponse.files = []; // Set default value if 'files' key is missing
  }
  return jsonResponse;
}

function validateImportantFunctionResponse(jsonResponse) {
  if (!jsonResponse.code) {
    jsonResponse.code = []; // Set default value if 'code' key is missing
  }
  return jsonResponse;
}

module.exports = { selectKeyFiles, pickImportantCodeFromRepoForTask, getImportantFunctionsFromFiles };