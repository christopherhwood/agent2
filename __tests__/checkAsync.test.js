const { findIncorrectAsyncUsage } = require('../modules/code/codingTaskResolver/analyzer/errors/checkAsync.js');

const missingAsyncCode = `
async function fetchData() {
    return await fetch('/api/data');
}

function logData() {
    console.log(await fetchData()); // Incorrect usage
}
`;

const extraAsyncCode = `
async function add() {
  return 2 + 2;
}
`;

// Use jest to write a test for this function.

describe('checkAsync', () => {
  it('should return an error message when await is used in a non-async function', () => {
    const errors = findIncorrectAsyncUsage(missingAsyncCode);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Function \'logData\' must be async to use \'await\'');
    expect(errors[0].line).toBe(7);
    expect(errors[0].column).toBe(17);
    expect(errors[0].code).toBe('await fetchData()');
  });

  it('should return an error message when an async function does not use await', () => {
    const errors = findIncorrectAsyncUsage(extraAsyncCode);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Function \'add\' is async but does not use \'await\'');
    expect(errors[0].line).toBe(2);
    expect(errors[0].column).toBe(1);
    expect(errors[0].code).toBe('async function add() {\n  return 2 + 2;\n}');
  });
});