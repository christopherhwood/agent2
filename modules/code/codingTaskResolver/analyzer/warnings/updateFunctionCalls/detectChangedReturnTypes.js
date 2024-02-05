// Function to detect changes in return types between two versions of code
function detectChangedReturnTypes(originalFunctionSignatures, newFunctionSignatures) {
  // Initialize an array to hold functions with changed return types
  const changedReturnTypes = [];

  // Create a map for easier lookup of new function signatures by name
  const newSignaturesMap = new Map(newFunctionSignatures.map(sig => [sig.name, sig]));

  // Iterate over the original function signatures to detect changes
  originalFunctionSignatures.forEach(originalSig => {
    const newSig = newSignaturesMap.get(originalSig.name);
    if (newSig && !areReturnTypesEqual(originalSig.returnType, newSig.returnType)) {
      // If there's a change in return type, add to the result array
      changedReturnTypes.push({
        functionName: originalSig.name,
        oldReturnType: originalSig.returnType,
        newReturnType: newSig.returnType
      });
    }
  });

  return changedReturnTypes;
}

// Helper function to compare return types
function areReturnTypesEqual(oldType, newType) {
  // Implement comparison logic here. This could include checking for primitive type changes,
  // nullability, and object property deletions.
  // This is a placeholder implementation. Actual implementation will depend on the project's specific needs.
  return JSON.stringify(oldType) === JSON.stringify(newType);
}

module.exports = detectChangedReturnTypes;

