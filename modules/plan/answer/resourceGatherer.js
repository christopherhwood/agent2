const { executeCommand } = require('../../../dockerOperations');
const { queryLlmWithJsonCheck } = require('../../../llmService');

async function gatherResources(repoName, repoContext, repoAnalysis, repoSummary, question) {
  let resourceNames = new Set();
  let resources = [];
  let i = 0;
  while (i < 3) {
    // Get new resources
    const resourceList = await queryForResources(repoContext, repoAnalysis, repoSummary, question, resources);
    
    // Compare existing list of resources with new list
    // Make adjustments to existing list like removing resources that are no longer needed or adding new resources
    // If no new resources need to be added, then return the list of resources
    const newResources = resourceList.files.filter(file => !resourceNames.has(file));
    const removedResources = Array.from(resourceNames).filter(file => !resourceList.files.includes(file));
    if (removedResources.length > 0) {
      resourceNames.delete(...removedResources);
      resources = resources.filter(resource => !removedResources.includes(resource.name));
    }
    if (newResources.length === 0) {
      return resources;
    }

    // Get contents of new resources and add them to the list of resources
    for (const fileName of newResources) {
      const fileContents = await executeCommand(`cat ${fileName}`, repoName);
      resources.push({name: fileName, contents: fileContents});
      resourceNames.add(fileName);
    }
    i++;
  }
  return resources;
}

async function queryForResources(repoContext, repoAnalysis, repoSummary, question, resources) {
  const newResources = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: query(repoContext, repoAnalysis, repoSummary, question, resources)}], validateResourceList);
  return newResources;
}

const validateResourceList = (llmResponse) => {
  if (typeof llmResponse !== 'object') {
    throw new Error('LLM response is not a json object.');
  }
  if (!Array.isArray(llmResponse.files)) {
    throw new Error('LLM response does not contain a files array.');
  }
  if (!llmResponse.files.every(file => typeof file === 'string' && file.length > 0)) {
    throw new Error('LLM response contains an invalid file name.');
  }
  return llmResponse;
};

const query = (repoContext, repoAnalysis, repoSummary, question, resources) => {
  let repoContextString = `# Repository Context\n## Directory Tree\n\`\`\`\n${repoContext.directoryTree}\n\`\`\`\n`;
  repoContextString += `## Recent Commits\n\`\`\`\n${repoContext.recentCommits}\n\`\`\`\n\n`;

  let repoAnalysisString = '# Repository File Analysis\n';
  for (const file of repoAnalysis) {
    repoAnalysisString += `## File Name: ${file.fileName}\n`;
    if (file.dependencies.local.length > 0 || file.dependencies.external.length > 0) {
      repoAnalysisString += '### File Dependencies\n';
      if (file.dependencies.local.length > 0) {
        repoAnalysisString += `  - **Local Dependencies:** ${file.dependencies.local.join(', ')}\n`;
      }
      if (file.dependencies.external.length > 0) {
        repoAnalysisString += `  - **External Dependencies:** ${file.dependencies.external.join(', ')}\n`;
      }
    }
    if (file.functions.length > 0) {
      repoAnalysisString += '### File Functions\n';
      for (const func of file.functions) {
        repoAnalysisString += `  - ${func.name}(${func.parameters.join(', ')})\n`;
      }
    }
  }

  if (resources.length > 0) {
    let resourceList = '';
    for (let i = 0; i < resources.length; i++) {
      resourceList += JSON.stringify(resources[i]) + '\n';
    }
    return `Select the resources needed to answer the following question:\n${question}. Examine the previously selected resources and make edits if necessary. Return your response as a json object with the following format: {files: ['relative/path/to/file1', 'relative/path/to/file2']}\n\n${repoContextString}\n\n# Repository Summary\n${repoSummary}\n\n${repoAnalysisString}\n\n# Previously Selected Resources\n${resourceList}`;
  }
  return `Select the resources needed to answer the following question:\n${question}. Return your response as a json object with the following format: {files: ['relative/path/to/file1', 'relative/path/to/file2']}\n\n${repoContextString}\n\n# Repository Summary\n${repoSummary}\n\n${repoAnalysisString}`;
};

const systemPrompt = `You are a Resource Identification System, specifically programmed to determine the key files necessary to answer questions about a JavaScript repository. Your task is to analyze questions related to the repository's structure, functionality, or coding practices and identify the relevant files from the repository's summary, including their directory structure, file dependencies, and function names. Your output should be a JSON object listing only the critical files needed to answer the question, focusing on relevance and minimizing the number of files to those absolutely essential.

Upon receiving a question about the repository:

1. Understand the core of the question, determining whether it relates to design patterns, coding practices, specific functionalities, dependencies, or other aspects of the repository.

2. Based on your analysis of the question, identify which files from the repository summary are pertinent. Consider factors like the files' locations within the directory structure, their local and external dependencies, and the functions they contain.

3. Compile a list of these essential files, using their relative paths within the repository.

4. Format your output as a JSON object, listing the files under a "files" key. The format should be:
   \`\`\`json
   {
     "files": [
       "relative/path/to/file1",
       "relative/path/to/file2",
       // Include additional files as necessary
     ]
   }
   \`\`\`
  
5. Be prepared for an iterative process, where your file selection may be reviewed and feedback provided. Adjust your list accordingly, adding or removing files based on this feedback.

6. Continue refining your list until it accurately represents only those files necessary to answer the question, ensuring the list is concise and limited to essential resources.

Your role is not to provide answers but to efficiently identify and list the specific files that are critical for formulating an accurate response to the given question. This approach prioritizes precision and relevance in resource selection, streamlining the process of answering queries about the repository.`;

module.exports = { gatherResources };