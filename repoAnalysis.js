const Docker = require('dockerode');
const fs = require('fs');
const os = require('os');
const { prepareConfirmationQuery } = require('./llmQueries');
const { iterateLlmQuery } = require('./llmService');
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
    const recentCommits = await executeCommandInContainer(container, 'git -C /repo log -n 5 --pretty=format:"%h - %an, %ar : %s"');

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
      const gitBlame = await executeCommandInContainer(container, `git -C /repo blame ${fileName}`);
      const gitHistory = await executeCommandInContainer(container, `git -C /repo log -n 3 --pretty=format:"%h - %an, %ar : %s" -- ${fileName}`);
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
    // Assuming fetchInvestigationData and mergeInvestigationData are async functions
    const additionalData = await fetchInvestigationData(llmResponse, repoName);
    return prepareConfirmationQuery(taskDescription, initialContext, mergeInvestigationData(currentInvestigationData, additionalData));
  }

  function isInvestigationDataSufficient(llmResponse) {
    return llmResponse.files.length === 0 && llmResponse.commits.length === 0 || isSubsetOfCurrentData(llmResponse, currentInvestigationData);
  }

  const initialQuery = prepareConfirmationQuery(taskDescription, initialContext, investigationData);

  return iterateLlmQuery(initialQuery, refineInvestigationQuery, isInvestigationDataSufficient, systemPrompt);
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

async function updateRepository(container, repoPath) {
  try {
    // Determine the default branch
    const defaultBranchCommand = `git -C ${repoPath} remote show origin | grep "HEAD branch" | cut -d" " -f5`;
    let defaultBranch = await executeCommandInContainer(container, defaultBranchCommand);

    // Pull the latest changes from the default branch
    const gitPullCommand = `git -C ${repoPath} pull origin ${defaultBranch.trim()}`; // origin ${defaultBranch.trim()}`;
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

  // Start the exec command
  const execStream = await exec.start({ Detach: false });

  return new Promise((resolve, reject) => {
    const output = [];
    
    // 'data' event for capturing stdout output
    execStream.on('data', (chunk) => output.push(chunk.toString()));

    // 'end' event for resolving the promise
    execStream.on('end', () => {
      // Remove non-printable characters except for newlines
      const outputStr = output.join('').replace(/[^\x20-\x7E\n]+/g, '');
      resolve(outputStr);
    });

    // 'error' event for rejecting the promise
    execStream.on('error', reject);

    // Ensure stream is properly ended after data is captured
    execStream.on('finish', () => {
      // Remove non-printable characters except for newlines
      const outputStr = output.join('').replace(/[^\x20-\x7E\n]+/g, '');
      resolve(outputStr);
    });
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


module.exports = { getInitialContext, fetchInvestigationData, confirmInvestigationDataWithLlm };
