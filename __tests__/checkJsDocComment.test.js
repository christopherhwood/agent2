const { validateJsDocComments } = require('../modules/code/codingTaskResolver/analyzer/errors/checkJSDocComment');

describe('validateJsDocComments', () => {
  it('should return an empty array for valid JSDoc comments', () => {
    const code = `
      /**
       * Adds two numbers.
       * @param {number} a The first number.
       * @param {number} b The second number.
       * @return {number} The sum of a and b.
       */
      function add(a, b) {
        return a + b;
      }
    `;

    const errors = validateJsDocComments(code);
    expect(errors).toEqual([]);
  });

  it('should return an array with errors for invalid JSDoc comments', () => {
    const code = `
      /**
       * Subtracts two numbers.
       * @param {number} a The first number.
       * @param {number} b The second number.
       */
      function subtract(a, b) {
        return a - b;
      }
    `; // Missing @return tag

    const errors = validateJsDocComments(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Missing @return tag');
  });

  it('should return an array with errors for a function with no JSDoc comments', () => {
    const code = `
        function multiply(a, b) {
          return a * b;
        }
      `;
  
    const errors = validateJsDocComments(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Missing JSDoc comment');
  });
  
  it('should return an array with errors for JSDoc with incorrect parameter names', () => {
    const code = `
        /**
         * Divides two numbers.
         * @param {number} x The numerator.
         * @param {number} y The denominator.
         * @return {number} The quotient.
         */
        function divide(a, b) {
          return a / b;
        }
      `; // Incorrect parameter names in JSDoc
  
    const errors = validateJsDocComments(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Parameter name mismatch');
  });
  
  it('should return an array with errors for JSDoc with incorrect parameter count', () => {
    const code = `
        /**
         * Calculates the remainder.
         * @param {number} a The dividend.
         * @return {number} The remainder.
         */
        function mod(a, b) {
          return a % b;
        }
      `; // Missing parameter in JSDoc
  
    const errors = validateJsDocComments(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Parameter count mismatch');
  });
  
  it('should handle multiple functions in the same code snippet', () => {
    const code = `
        /**
         * Increments a number.
         * @param {number} a The number to increment.
         * @return {number} The incremented number.
         */
        function increment(a) {
          return a + 1;
        }
  
        /**
         * Decrements a number.
         * @param {number} b The number to decrement.
         * @return {number} The decremented number.
         */
        function decrement(b) {
          return b - 1;
        }
      `;
  
    const errors = validateJsDocComments(code);
    expect(errors).toEqual([]); 
  });
});
  
