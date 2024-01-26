const { findIncorrectDependencies } = require('../modules/code/codingTaskResolver/analyzer/errors/checkImports');
const fs = require('fs');
const { extractDependencies } = require('../modules/summary/analysis/dependencyAnalysis');

// Mocking fs.existsSync
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

// Mocking extractDependencies
jest.mock('../modules/summary/analysis/dependencyAnalysis', () => ({
  extractDependencies: jest.fn(),
}));

describe('findIncorrectDependencies', () => {
  it('should return an empty array when all local dependencies exist', () => {
    extractDependencies.mockReturnValue({
      local: [{ pathRelativeToRoot: 'path/to/existing/file', line: 1, column: 1, code: 'code' }],
    });
    fs.existsSync.mockReturnValue(true);

    const result = findIncorrectDependencies('fileContents', 'basePath');
    expect(result).toEqual([]);
  });

  it('should return an array with errors when some local dependencies do not exist', () => {
    const missingFilePath = 'path/to/nonexistent/file';
    extractDependencies.mockReturnValue({
      local: [{ pathRelativeToRoot: missingFilePath, line: 2, column: 3, code: 'code' }],
    });
    fs.existsSync.mockReturnValue(false);

    const result = findIncorrectDependencies('fileContents', 'basePath');
    expect(result).toEqual([
      { message: `File ${missingFilePath} does not exist.`, line: 2, column: 3, code: 'code' }
    ]);
  });
});
