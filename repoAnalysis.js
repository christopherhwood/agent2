const Docker = require('dockerode');
const fs = require('fs');
const os = require('os');
const { prepareInvestigationQuery, prepareSummaryQuery, prepareConfirmationQuery, prepareSummaryConfirmationQuery } = require('./llmQueries');
const { queryLlm, queryLlmWithJsonCheck, iterateLlmQuery } = require('./llmService');
const docker = new Docker();

const hostRepoPath = '/var/qckfx/repos';
const fallbackHostRepoPath = `${os.homedir()}/repos`;

async function prepareSummary(repoName, taskDescription) {
  let keyFiles = [];
  let keyCommits = [];

  // 1. Get directory tree & recent commits
  const context = await getInitialContext(repoName); 
  console.log(context);

  // 2. & 3. Get and fetch investigation suggestions
  const investigationQuery = prepareInvestigationQuery(taskDescription, context);
  let systemPrompt = `You are an expert code analysis bot with a specialization in JavaScript codebases. Your mission is to analyze the provided directory tree and recent commit history of a Git repository, identifying the files and commits most relevant to a specific development task.

  Upon receiving the directory structure, a list of recent commits, and the task description, your task involves:
  
  1. Analyzing the directory tree to identify relevant JavaScript files. Focus on discerning the relative paths of files that are likely critical for the task, considering the overall structure and organization of the codebase.
  2. Reviewing recent commit history, with an emphasis on changes that could impact or be pertinent to the task. Pay special attention to commit messages, authors, timestamps, and the specific nature of the changes in the code.
  3. Correlating these findings with the details of the task to pinpoint the most relevant files and commits.
  
  Your output should be in the form of a structured JSON object containing two arrays: one for the relative paths of pertinent files, and one for the hashes of relevant commits. Ensure that the file paths are relative to the root of the repository as per the provided directory tree.
  
  Example output format:

  { "files": ["relative/path/to/file1.js", "relative/path/to/file2.js"], "commits": ["commitHash1", "commitHash2"] }


  Your analysis should be precise and focused, enabling the user to direct their efforts effectively towards the most significant aspects of the codebase for the task at hand. The goal is to provide a clear, concise, and relevant list of files and commits, aiding in an efficient approach to task resolution.`;
  const investigationSuggestions = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: investigationQuery}], validateInvestigationResponse);
  console.log(investigationSuggestions);

  const investigationData = await fetchInvestigationData(investigationSuggestions, repoName);

  console.log('investigationData:');
  console.log(investigationData);

  // 4. & 5. Initial and iterative confirmation
  const confirmationResponse = await confirmInvestigationDataWithLlm(
    taskDescription, 
    context, 
    investigationData, 
    repoName, 
    systemPrompt
  );

  console.log('confirmationResponse:');
  console.log(confirmationResponse);

  keyFiles = confirmationResponse.files;
  keyCommits = confirmationResponse.commits;

  // 6. & 7. Send deep dive context for summary and confirm summary
  const summaryQuery = prepareSummaryQuery(taskDescription, keyFiles, keyCommits);
  systemPrompt = `You are a software development synthesis expert, adept at distilling complex codebase information into concise, actionable summaries. Your primary role is to delve into the contents of key files and the details of relevant commits from a Git repository, focusing on their significance in the context of a specific user task.

  Your task involves:
  
  1. Analyzing the contents of each identified file, understanding their functionalities, code structure, and any peculiarities in their JavaScript implementation.
  2. Examining the details of pertinent commits, including commit messages, changes made, and their implications for the current task. Leverage Git blame and history data to understand the evolution and the rationale behind these changes.
  3. Integrating this information to create a comprehensive summary that conveys a clear understanding of how each file and commit is relevant to the user's task. Your summary should illuminate connections between different pieces of code and commits, highlighting dependencies, potential impacts, and areas requiring attention.
  
  The summary should be structured in Markdown for clarity and ease of reading. Aim for a balance between brevity and thoroughness, ensuring that your summary is not only informative but also provides deep insights into the task at hand. Your objective is to equip the user with a clear understanding of the code and commits, guiding them effectively in resolving the task.
  
  Focus on delivering a summary that serves as a practical guide for task resolution, emphasizing key points and actionable insights drawn from the code and commit history.`;
  const finalSummary = await generateAndConfirmSummaryWithLlm(summaryQuery, taskDescription, keyFiles, keyCommits, systemPrompt);

  // 8. Return finalized summary and tracked items to the user
  return { summary: finalSummary, keyFiles, keyCommits };
}

async function getInitialContext(repoName) {
  let container = null;

  try {
    container = await createAnalysisContainer(repoName);

    await container.start();

    await updateRepository(container, '/repo');

    // Execute commands to get directory tree and recent commits
    const directoryTree = await executeCommandInContainer(container, 'tree /repo -I "node_modules|.git|package-lock.json"');
    const recentCommits = await executeCommandInContainer(container, 'git --no-pager -C /repo log -n 5 --pretty=format:"%h - %an, %ar : %s"');

    return {
      directoryTree,
      recentCommits
    };
  } catch (error) {
    console.error('Error getting initial context:', error);
    throw error;
  } finally {
    // Clean up: stop and remove the temporary container
    if (container) {
      await container.stop();
      await container.remove();
    }
  }
}

async function fetchInvestigationData(gptResponse, repoName) {
  // Initialize structures to hold investigation data
  let filesData = [];
  let commitsData = [];

  // Parse GPT-4 response
  const { files, commits } = gptResponse;

  let container = null;

  try {
    // Create a temporary container for fetching data
    container = await createAnalysisContainer(repoName);

    await container.start();

    // Fetch Git blame and history for each identified file
    for (const fileName of files) {
      const gitBlame = await executeCommandInContainer(container, `git --no-pager -C /repo blame ${fileName}`);
      const gitHistory = await executeCommandInContainer(container, `git --no-pager -C /repo log -n 3 --pretty=format:"%h - %an, %ar : %s" -- ${fileName}`);
      filesData.push({ name: fileName, blame: gitBlame, history: gitHistory });
    }

    // Fetch data for each identified commit
    for (const commitHash of commits) {
      const commitDetails = await executeCommandInContainer(container, `git -C /repo show ${commitHash.substring(0, 7)}`);
      commitsData.push({ hash: commitHash.substring(0, 7), details: commitDetails });
    }

    return { files: filesData, commits: commitsData };
  } catch (error) {
    console.error('Error fetching investigation data:', error);
    throw error;
  } finally {
    // Clean up: stop and remove the temporary container
    if (container) {
      await container.stop();
      await container.remove();
    }
  }
}

async function confirmInvestigationDataWithLlm(taskDescription, initialContext, investigationData, repoName, systemPrompt) {
  let currentInvestigationData = investigationData;

  async function refineInvestigationQuery(llmResponse) {
    // Fetch investigation data for files or commits not already in the current data
    const newFiles = llmResponse.files.filter(f => !currentInvestigationData.files.filter(f2 => f2.name === f).length);
    const newCommits = llmResponse.commits.filter(c => !currentInvestigationData.commits.filter(c2 => c2.hash === c).length);
    const newInvestigationData = await fetchInvestigationData({ files: newFiles, commits: newCommits }, repoName);

    // Remove data for files or commits not listed in the new llmResponse
    const filteredFiles = currentInvestigationData.files.filter(f => llmResponse.files.includes(f.name));
    const filteredCommits = currentInvestigationData.commits.filter(c => llmResponse.commits.includes(c.hash));

    // Merge new data with filtered data
    currentInvestigationData = {
      files: [...filteredFiles, ...newInvestigationData.files],
      commits: [...filteredCommits, ...newInvestigationData.commits]
    };
    return prepareConfirmationQuery(taskDescription, initialContext, currentInvestigationData);
  }

  function isInvestigationDataSufficient(llmResponse) {
    // Stop when the llm returns the same data as the current data
    return isEqualToCurrentData(llmResponse, currentInvestigationData);
  }

  const initialQuery = prepareConfirmationQuery(taskDescription, initialContext, investigationData);

  await iterateLlmQuery(initialQuery, refineInvestigationQuery, isInvestigationDataSufficient, systemPrompt, confirmInvestigationQueryWithVerification);
  return currentInvestigationData;
}

async function confirmInvestigationQueryWithVerification(messages) {
  const validation = (jsonResponse) => {
    if (!jsonResponse.files) {
      jsonResponse.files = []; // Set default value if 'files' key is missing
    }
    if (!jsonResponse.commits) {
      jsonResponse.commits = []; // Set default value if 'commits' key is missing
    }
    return jsonResponse;
  };

  return queryLlmWithJsonCheck(messages, validation);
}

async function createAnalysisContainer(repoName) {
  const repoPath = fs.existsSync(hostRepoPath) 
    ? hostRepoPath 
    : fallbackHostRepoPath;
  const bindMount = `${repoPath}/${repoName}:/repo`;

  // Create a temporary container for analysis
  const container = await docker.createContainer({
    Image: 'qckfx-sandbox', // has tree installed
    Cmd: ['/bin/bash'],
    Tty: true,
    Volumes: { '/repo': {} },
    HostConfig: { Binds: [bindMount] }
  });
  return container;
}

async function generateAndConfirmSummaryWithLlm(summaryQuery, taskDescription, keyFiles, keyCommits, systemPrompt) {
  // First, get the initial summary from GPT
  let summaryResponse = await queryLlm([{role: 'system', content: systemPrompt}, {role: 'user', content: summaryQuery}]);
  console.log('initialSummaryResponse:');
  console.log(summaryResponse);

  // Prepare the query to confirm the summary
  const initialConfirmationQuery = prepareSummaryConfirmationQuery(summaryResponse, taskDescription, keyFiles, keyCommits);

  async function refineSummaryQueryFunction(llmResponse) {
    if (!llmResponse.includes('ok') && llmResponse.length < 10) {
      summaryResponse = llmResponse;
    }
    return prepareSummaryConfirmationQuery(llmResponse, taskDescription, keyFiles, keyCommits);
  }

  function isSummarySufficientFunction(llmResponse) {
    // Check if GPT's response is "ok", indicating the summary is sufficient
    return llmResponse.includes('ok') && llmResponse.length < 10;
  }

  // Use iterateLlmQuery for the iterative confirmation process
  await iterateLlmQuery(initialConfirmationQuery, refineSummaryQueryFunction, isSummarySufficientFunction, systemPrompt, queryLlm);
  return summaryResponse;
}

async function updateRepository(container, repoPath) {
  try {
    // Determine the default branch
    const defaultBranchCommand = `git --no-pager -C ${repoPath} remote show origin | grep "HEAD branch" | cut -d" " -f5`;
    let defaultBranch = await executeCommandInContainer(container, defaultBranchCommand);

    // Pull the latest changes from the default branch
    const gitPullCommand = `git --no-pager -C ${repoPath} pull origin ${defaultBranch.trim()}`; // origin ${defaultBranch.trim()}`;
    await executeCommandInContainer(container, gitPullCommand);
  } catch (error) {
    console.error('Error updating repository:', error);
    throw error;
  }
}

// Function to execute a command inside a Docker container
async function executeCommandInContainer(container, command) {
  console.log('command = ' + command);
  const exec = await container.exec({
    Cmd: ['bash', '-c', command],
    AttachStdout: true,
    AttachStderr: true
  });

  const execStream = await exec.start({ Detach: false });
  execStream.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    const output = [];

    execStream.on('data', (chunk) => {
      // The first 8 bytes of the stream are a header used by docker, so we skip them
      output.push(chunk.slice(8));
    });

    execStream.on('end', () => {
      const outputStr = output.toString().replace(/[^\x20-\x7E\n]+/g, '');
      console.log('Output:', outputStr);
      resolve(outputStr);
    });

    execStream.on('error', reject);
  });
}

// Checks if the LLM response is exactly equal to the current data
function isEqualToCurrentData(llmResponse, currentData) {
  if (llmResponse.files.length !== currentData.files.length || llmResponse.commits.length !== currentData.commits.length) {
    return false;
  }

  for (const file of llmResponse.files) {
    if (!currentData.files.filter(f => f.name === file).length) {
      return false;
    }
  }
  for (const commit of llmResponse.commits) {
    if (!currentData.commits.filter(c => c.hash === commit).length) {
      return false;
    }
  }
}

function validateInvestigationResponse(jsonResponse) {
  if (!jsonResponse.files) {
    jsonResponse.files = []; // Set default value if 'files' key is missing
  }
  if (!jsonResponse.commits) {
    jsonResponse.commits = []; // Set default value if 'commits' key is missing
  }
  return jsonResponse;
}

module.exports = { prepareSummary };
