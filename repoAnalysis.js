const Docker = require('dockerode');
const fs = require('fs');
const os = require('os');
const { prepareConfirmationQuery, prepareSummaryConfirmationQuery } = require('./llmQueries');
const { queryLlm, queryLlmWithJsonCheck, iterateLlmQuery } = require('./llmService');
const docker = new Docker();

const hostRepoPath = '/var/qckfx/repos';
const fallbackHostRepoPath = `${os.homedir()}/repos`;

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
      const commitDetails = await executeCommandInContainer(container, `git -C /repo show ${commitHash}`);
      commitsData.push({ hash: commitHash, details: commitDetails });
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

  async function refineInvestigationQuery(llmResponse, currentQuery) {
    if (llmResponse.files.length > 0 || llmResponse.commits.length > 0) {
      const additionalData = await fetchInvestigationData(llmResponse, repoName);
      currentInvestigationData = mergeInvestigationData(currentInvestigationData, additionalData);
    }
    return prepareConfirmationQuery(taskDescription, initialContext, currentInvestigationData);
  }

  function isInvestigationDataSufficient(llmResponse) {
    return llmResponse.files.length === 0 && llmResponse.commits.length === 0 || isSubsetOfCurrentData(llmResponse, currentInvestigationData);
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

  async function refineSummaryQueryFunction(llmResponse, currentQuery) {
    if (!llmResponse.includes('ok') && llmResponse.length < 10) {
      summaryResponse = llmResponse;
    }
    return prepareSummaryConfirmationQuery(llmResponse, taskDescription, keyFiles, keyCommits);
  }

  function isSummarySufficientFunction(llmResponse) {
    // Check if GPT's response is "ok", indicating the summary is sufficient
    return llmResponse.includes('ok') && llmResponse.length < 10;
  }

  // Check if the initial summary response is already sufficient
  if (isSummarySufficientFunction(summaryResponse)) {
    return summaryResponse; // If the initial response is sufficient
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


function mergeInvestigationData(existingData, additionalData) {
  const mergedFiles = [...new Set([...existingData.files, ...additionalData.files])];
  const mergedCommits = [...new Set([...existingData.commits, ...additionalData.commits])];

  return { files: mergedFiles, commits: mergedCommits };
}

function isSubsetOfCurrentData(llmResponse, currentData) {
  const allFiles = new Set(currentData.files.map(file => file.name));
  const allCommits = new Set(currentData.commits.map(commit => commit.hash));

  return llmResponse.files.every(file => allFiles.has(file)) &&
         llmResponse.commits.every(commit => allCommits.has(commit));
}


module.exports = { getInitialContext, fetchInvestigationData, confirmInvestigationDataWithLlm, generateAndConfirmSummaryWithLlm };
