// Function to detect changes in return types between two versions of code
function detectChangedReturnTypes(originalFunctionSignatures, newFunctionSignatures) {
  // Initialize an array to hold functions with changed return types
  const changedReturnTypes = [];

  // Create a map for easier lookup of new function signatures by name
  const newSignaturesMap = new Map(newFunctionSignatures.map(sig => [sig.name, sig]));

  // Iterate over the original function signatures to detect changes
  originalFunctionSignatures.forEach(originalSig => {
    const newSig = newSignaturesMap.get(originalSig.name);
    if (newSig && !areReturnTypesEqual(originalSig.returnTypes, newSig.returnTypes)) {
      // If there's a change in return type, add to the result array
      changedReturnTypes.push({
        functionName: originalSig.name,
        oldReturnTypes: originalSig.returnTypes,
        newReturnTypes: newSig.returnTypes
      });
    }
  });

  return changedReturnTypes;
}

// Helper function to compare return types
function areReturnTypesEqual(oldTypes, newTypes) {
  return JSON.stringify(oldTypes) === JSON.stringify(newTypes);
}

module.exports = detectChangedReturnTypes;

