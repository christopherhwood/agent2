const { extractDependencies } = require('../../../../summary/analysis/dependencyAnalysis');
const { executeCommand } = require('../../../../../dockerOperations');

async function gatherImportedFunctionCallContext(newlyAddedCode, fileContentsWithNewlyAddedCode, basePath, repoName) {
  const dependencies = await extractDependencies(fileContentsWithNewlyAddedCode, basePath, repoName);
  const newlyUsedLocalDependencies = getNewlyUsedLocalDependencies(newlyAddedCode, dependencies.local);

  const dependencyPromises = newlyUsedLocalDependencies.map(async (dependency) => {
    try {
      const path = dependency.pathRelativeToRoot;
      const contents = await getDependencyContents(path, repoName);
      const exampleUsages = await getExampleUsages(dependency, basePath, repoName);

      return { path, dependency, contents, exampleUsages };
    } catch (error) {
      console.error(`Error processing dependency ${dependency.pathRelativeToRoot}: ${error}`);
      return null;
    }
  });

  const resolvedDependencies = await Promise.allSettled(dependencyPromises);

  let dependencyInfo = resolvedDependencies.reduce((info, result) => {
    if (result.status === 'fulfilled' && result.value) {
      const { path, dependency, contents, exampleUsages } = result.value;
      info[path] = { dependency, fileContents: contents, exampleUsages };
    }
    return info;
  }, {});

  return dependencyInfo;

  // TODO: Get documentation for external dependency exports
}


async function getDependencyContents(pathRelativeToRoot, repoName) {
  let jsPath = pathRelativeToRoot;
  if (!jsPath.endsWith('.js')) {
    jsPath += '.js';
  }
  const contents = await executeCommand(`cat ${jsPath}`, repoName);
  if (!contents.includes('No such file or directory') && !contents.includes('Is a directory')) {
    return contents;
  }
  let indexPath = pathRelativeToRoot;
  if (!indexPath.endsWith('/index.js')) {
    indexPath += '/index.js';
  }
  const indexContents = await executeCommand(`cat ${indexPath}`, repoName);
  if (!indexContents.includes('No such file or directory') && !indexContents.includes('Is a directory')) {
    return indexContents;
  }
  throw new Error(`Could not find file ${pathRelativeToRoot}`);
}

async function getExampleUsages(dependency, basePath, repoName) {
  let exampleUsages = [];

  const greppedFiles = await getGreppedFiles(dependency, basePath, repoName);
  console.log('greppedFiles', greppedFiles);
  for (const file of greppedFiles) {
    const contents = await executeCommand(`cat ${file}`, repoName);
    const dependencies = await extractDependencies(contents, file, repoName);
    for (const dep of dependencies.local) {
      // Compare the file name of the example dependency path to root with the file name of the dependency path to root
      // If they are the same, then the example dependency is the same as the dependency we are getting example usage for
      
      if (dependency.importGrepPatterns.includes(dep.pathRelativeToRoot.split('/').pop())) {
        if (dep.exports.default) {
          const usages = extractContextForDependencyImport(dep.exports.default, getTargetProperties(dependency), contents);
          exampleUsages.push(...usages);
        } else if (dep.exports.named.length > 0) {
          for (const namedExport of dep.exports.named) {
            const usages = extractContextForDependencyImport(namedExport, getTargetProperties(dependency), contents);
            exampleUsages.push(...usages);
          }
        } else if (dep.exports.namespace) {
          const usages = extractContextForDependencyImport(dep.exports.namespace, getTargetProperties(dependency), contents);
          exampleUsages.push(...usages);
        }
      }
    }
  }
  console.log('exampleUsages', exampleUsages);
  return exampleUsages;
}

function getTargetProperties(dependency) {
  if (dependency.exports.default.objectProperties.length > 0) {
    return dependency.exports.default.objectProperties; 
  } else if (dependency.exports.named.length > 0) {
    let targetProperties = [];
    for (const namedExport of dependency.exports.named) {
      if (namedExport.objectProperties.length > 0) {
        targetProperties.push(...namedExport.objectProperties);
      }
    }
    return targetProperties;
  } else if (dependency.exports.namespace) {
    return dependency.exports.namespace.objectProperties;
  }
  return [];
}

function extractContextForDependencyImport(dependencyImport, targetProperties, contents) {
  let usages = [];
  if (dependencyImport.isClass) {
    // Search for 'new ${dependencyImport.alias}'
    const search = `new ${dependencyImport.alias}`;
    let index = contents.indexOf(search);
    while (index !== -1) {
      const context = extractContext(contents, index);
      usages.push(context);
      index = contents.indexOf(search, index + search.length);
    }
  } else if (dependencyImport.isFunction) {
    // Search for '${dependencyImport.alias}('
    const search = `${dependencyImport.alias}(`;
    let index = contents.indexOf(search);
    while (index !== -1) {
      const context = extractContext(contents, index);
      usages.push(context);
      index = contents.indexOf(search, index + search.length);
    }
  } else {
    for (const prop of targetProperties) {
      // Search for '${dependencyImport.alias}.'
      const search = `${dependencyImport.alias}.${prop}`;
      let index = contents.indexOf(search);
      while (index !== -1) {
        const context = extractContext(contents, index);
        usages.push(context);
        index = contents.indexOf(search, index + search.length);
      }
    }
  }
  return usages;
}


function extractContext(contents, index) {
  let start = index;
  let end = index;

  // Find the start of the context (5 lines before)
  for (let i = 0; i < 5; i++) {
    start = contents.lastIndexOf('\n', start - 1);
    if (start === -1) {
      start = 0;
      break;
    }
  }

  // Find the end of the context (3 lines after)
  for (let i = 0; i < 3; i++) {
    end = contents.indexOf('\n', end + 1);
    if (end === -1) {
      end = contents.length;
      break;
    }
  }

  // Extract the context
  return contents.substring(start, end);
}

async function getGreppedFiles(dependency, basePath, repoName) {
  let grepResults = new Set();
  
  const filenames = await getUniqueGreppedFilenames(dependency, repoName);
  console.log('unique grepped filenames: ', filenames);
  // Filter out original filename
  const otherFilenames = filenames.filter(filename => {
    return filename !== basePath;
  });
  grepResults.add(...otherFilenames);
  // If it's an empty set we can end up with an undefined in here
  return Array.from(grepResults).filter(filename => filename !== undefined);
}

async function getUniqueGreppedFilenames(dependency, repoName) {
  let filenames = new Set(); 
  const paths = dependency.importGrepPatterns;
  for (const path of paths) {
    // For single quotes: you have to end the single quote, then escape a single quote, then restart the single quote, then complete the single quote again. The command line will merge the quotes together.
    const result = await executeCommand(`git ls-files | xargs grep '${path}'\\'')'`, repoName);
    if (result.trim().length === 0) {
      continue;
    }
    // Get filenames from grep results
    filenames.add(...result.split('\n').map(line => line.split(':')[0]).filter(filename => filename.trim().length > 0));
  }
  return Array.from(filenames);
}

function getNewlyUsedLocalDependencies(newlyAddedCode, localDependencies) {
  let newlyUsedLocalDependencies = [];
  for (const dependency of localDependencies) {
    if (dependency.exports.default) {
      if (newlyAddedCode.includes(dependency.exports.default.alias)) {
        newlyUsedLocalDependencies.push(dependency);
      }
    } else if (dependency.exports.named.length > 0) {
      for (const namedExport of dependency.exports.named) {
        if (newlyAddedCode.includes(namedExport.alias)) {
          newlyUsedLocalDependencies.push(dependency);
        }
      }
    } else if (dependency.exports.namespace) {
      if (newlyAddedCode.includes(dependency.exports.namespace.alias)) {
        newlyUsedLocalDependencies.push(dependency);
      }
    }
  }
  console.log('newlyUsedLocalDependencies', newlyUsedLocalDependencies);
  return newlyUsedLocalDependencies;
}

module.exports = { gatherImportedFunctionCallContext };