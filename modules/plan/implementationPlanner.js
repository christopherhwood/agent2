const { queryLlm, queryLlmWithJsonCheck } = require('../../llmService');

async function genImplementationPlan(highLevelTask, taskDeepDive, problemStatement, prd) {
  const initialDoc = await queryLlm([{role: 'system', content: DesignDocSystemPrompt}, {role: 'user', content: designDocQuery(highLevelTask, taskDeepDive, problemStatement, prd)}]);
  console.log('Design Doc:\n', initialDoc);
  return await queryLlmWithJsonCheck([{role: 'system', content: ImplementationPlanSystemPrompt}, {role: 'user', content: implementationPlanQuery(highLevelTask, taskDeepDive, problemStatement, prd, initialDoc)}], implementationPlanValidator);
}

const designDocQuery = (highLevelTask, taskDeepDive, problemStatement, prd) => {
  return `Based on the following documents, give a complete design but keep it at a high level. We will get into details in later versions of the draft. For now keep it tech stack agnostic. We will get into tech stack details as we iterate on later versions.\n\n# High Level Task\n${highLevelTask}\n\n# Task Deep Dive\n${taskDeepDive}\n\n${problemStatement}\n\n${prd}`;
};

const implementationPlanQuery = (highLevelTask, taskDeepDive, problemStatement, prd, designDoc) => {
  return `# High Level Task\n${highLevelTask}\n\n# Task Deep Dive\n${taskDeepDive}\n\n${problemStatement}\n\n${prd}\n\n${designDoc}`;
};

const ImplementationPlanSystemPrompt = `You are a staff level engineer working on a new task. You are given the high level task, a task deep dive, a problem statement, a PRD, and a design doc. 

Your job is to turn this design doc into an implementation plan. Break it into high level steps based on what you know of the project right now. Avoid being prescriptive on implementation details of each task, and don't jump to any conclusions particularly on what parts of the existing code to leverage or which third party or open source software to integrate. 

The project is a closed project that only you are working on. No one will review anything you do, the project is left to your judgement and ability to deliver it. The plan is for your own sake and your own use. 

Only document what is absolutely necessary, focus the implementation on the actual coding work to be done. You will be provided a development environment that is setup correctly for the project and you will be provided with the code relevant to each step by our super advanced code retriever system, so there is no need to include steps related to reading code, familiarizing yourself with the codebase, or setting up your environment. Only focus on the tasks that involve writing code.

**IMPORTANT:** Do NOT recommend overly complex logging, error-handling, or testing. Recommend to follow existing patterns and practices from the codebase. Unless the high level task explicity requests it, do NOT suggest words like 'enhanced', 'improved', 'upgraded', etc. with regards to logging, error-handling, or testing. Keep the implementation as simple as possible and avoid scope creep.

**IMPORTANT:** Don't reference any properties on data objects, not even id!

Exclude any documentation steps outside of basic commenting that follows the existing codebase conventions.

As we work on adding details, keep the design malleable. It's okay to make changes if we uncover new information. 

Again, focus on the coding implementation part and don't worry about deployment, monitoring, model training, rollout plan, or anything that falls outside of the process of writing code that is committed to the repository.

You don't need to write many steps, if faced with a tradeoff between more steps or more details and fewer steps, always opt for more details and fewer steps. Look for ways to combine steps like 'write tests' and 'add logging' and 'add error handling' into the other implementation steps as details rather than carving out independent steps.

Return your response using json as seen in the example below.

Here is an example of the kind of output we are looking for:
\`\`\`json
{
  "steps": [
    {
      "title": "Step 1: Create Commit Message Generation Module",
      "description": "Develop a new module within the \`agent2\` repository dedicated to generating commit messages. This module will be responsible for interfacing with other parts of the system and managing the generation process.",
      "codingWork": "Write code to define the module structure, including functions for initiating the message generation process and handling inputs from the \`Coder\` class. Add documentation where necessary using jsdoc format."
    },
    {
      "title": "Step 2: Integrate Language Model (LLM)",
      "description": "Integrate a language model within the commit message generation module. This model will be responsible for processing input data and generating commit messages.",
      "codingWork": "Write code to integrate the LLM, ensuring it can receive input data and return generated messages. This includes coding the interfaces between the LLM and other components of the system. Document the interfaces and how to use them in detail. Add tests to validate the logic works as expected."
    },
    {
      "title": "Step 3: Develop Contextual Analysis Engine",
      "description": "Create an engine within the module to perform contextual analysis of code changes and associated task descriptions.",
      "codingWork": "Write code to analyze input data, extracting relevant information about the code changes and tasks. This includes coding algorithms or methods to interpret and process the data for the LLM. Add documentation where needed using jsdoc format. Add tests to ensure the logic works as expected."
    },
    {
      "title": "Step 4: Modify \`Coder\` Class for Triggering Message Generation",
      "description": "Update the \`Coder\` class to trigger the commit message generation process during commit operations.",
      "codingWork": "Modify the \`commitChanges\` method in the \`Coder\` class to call the commit message generation module whenever a commit is made. Add tests to validate the integration works as expected. Remove any old and out of date code and tests."
    },
    {
      "title": "Step 5: Implement Message Generation Logic",
      "description": "Develop the logic within the commit message generation module that uses input data and the LLM to generate commit messages.",
      "codingWork": "Code the logic that feeds input data to the LLM and processes its output to form a coherent, contextually relevant commit message. Add tests particularly around the validation of the LLM output. Document clearly the expected inputs and outputs for the LLM commit message generation function."
    },
    {
      "title": "Step 6: Review and Approval Mechanism",
      "description": "Implement a mechanism for developers to review and approve generated commit messages.",
      "codingWork": "Code a simple interface or method within the \`Coder\` class that allows developers to view, edit (if necessary), and approve the generated commit messages before finalizing the commit. Add tests and documentation where needed."
    },
    {
      "title": "Step 7: Testing and Iteration",
      "description": "Test the entire system to ensure it works as expected and iteratively refine based on test results.",
      "codingWork": "Write and execute test cases for different scenarios to validate the functionality of the commit message generation system. Make necessary code adjustments based on test feedback."
    },
  ]
}
\`\`\``;

const DesignDocSystemPrompt = `You are a staff level engineer working on a new task. You are given the high level task, a task deep dive, a problem statement, and a PRD. Your job is to put together a first draft of a design doc based on your prior experience. Do not get too in the weeds on this, we will have time later to revisit it and take a look at potential existing code we can leverage or third party libraries we can leverage, but for now we are just putting together a relatively vague and abstract draft off the cuff. Focus on the coding part of the task. Don't worry about deployment, monitoring, posting a pull request, setting up the development environment etc. Just focus on the code architecture, changes to be made, breaking it down into tasks, possible avenues for implementation, etc. Leave out any optional tasks. Focus on reducing complexity in implementation and delivering a simple and fundamentally sound implementation.

**IMPORTANT:** Do NOT recommend overly complex logging, error-handling, or testing. Recommend to follow existing patterns and practices from the codebase.

Don't include any optional features from the product team. Our focus is on building a simple and fundamentally sound implementation of only the required features. Be ruthless in your prioritization.

Skip documentation outside of basic commenting that follows the existing codebase conventions.

Explore various methods of implementation and select the least complex and most fundamentally sound solution. Reason out why you arrived at this solution.

Here is an example of the kind of output we are looking for:
\`\`\`markdown
# Automated Commit Message Generation System Design Document

## Introduction
This document outlines the approach to enhance commit message generation in the \`agent2\` repository, aiming to develop an automated system using machine learning models for detailed and contextually relevant commit messages.

## System Overview
The system integrates with the \`Coder\` class in \`agent2\`, utilizing a language model (LLM) to analyze code changes and task descriptions, focusing on creating informative and useful commit messages.

## System Components

1. **Commit Message Generation Module:**
   - Core module for generating commit messages, interfacing with the \`Coder\` class and processing code changes and task descriptions.

2. **Language Model Integration:**
   - Integrates an LLM to process input data and generate commit messages, trained to understand code changes and relate them to tasks.

3. **Contextual Analysis Engine:**
   - Analyzes the context of code changes, including related tasks or issues and their impact on the codebase.

## Workflow

1. **Triggering Commit Message Generation:**
   - Initiated during the commit operation in the \`Coder\` class, automatically starting the message generation process.

2. **Data Collection and Analysis:**
   - Collects and analyzes data about code changes and associated tasks or issues to understand scope and impact.

3. **Message Generation:**
   - The LLM generates a commit message summarizing changes, linking to tasks or issues, and providing insights into rationale and impact.

4. **Review and Commit:**
   - Presents the generated message for developer review, then attaches it to the commit once approved.

## Architectural Decisions

- **Use of Language Models:** Chosen for their ability to create rich, accurate descriptions, reducing complexity compared to manual or template-based methods.
- **Integration with Existing Workflow:** Maintains consistency with the \`Coder\` class and minimizes workflow disruptions.
- **Focus on Core Functionality:** Prioritizes automated commit message generation, avoiding complexities like manual crafting or advanced semantic analysis.

## Future Considerations

- **Scalability:** Designed to handle increasing volumes and varieties of tasks and changes.
- **Model Training and Updates:** Continuous model improvement based on developer inputs and corrections.
- **Feedback Mechanism:** Implementing a feedback loop to refine the model.

## Conclusion
This high-level overview presents the proposed system for enhancing commit message generation in \`agent2\`, leveraging language models for automation, clarity, accuracy, and relevance, designed to integrate seamlessly with the existing workflow.
\`\`\``;

const implementationPlanValidator = (response) => {
  if (!response || !response.steps) {
    throw new Error('Response must be an object with a steps property');
  }
  if (!Array.isArray(response.steps)) {
    throw new Error('Response must be an object with a steps property that is an array');
  }
  for (const step of response.steps) {
    if (!step.title || !step.description || !step.codingWork) {
      throw new Error('Each step must have a title, description, and codingWork property');
    }
  }
  return response;
};

module.exports = { genImplementationPlan };