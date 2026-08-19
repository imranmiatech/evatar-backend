import { Project } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const methodsToRemoveFromCarehub = [
  'createModule', 'updateModule', 'getAdminModules', 'toggleModuleStatus', 'getAdminModuleDetail',
  'getChildInsights', 'getMonthlyHighlights', 'getChildNotes', 'createChildNote', 'deleteChildNote',
  'startQuiz', 'submitQuiz', 'getQuizResult'
];

const methodsToRemoveFromInsights = [
  'createModule', 'updateModule', 'getAdminModules', 'toggleModuleStatus', 'getAdminModuleDetail',
  'getModules', 'getCareHomeTopics', 'getMyCareChildren', 'getSuggestedModules', 'getModuleDetail', 'saveModule', 'removeSavedModule', 'assignModuleToNannies', 'getCareHome', 'getCareHomeTabs',
  'startQuiz', 'submitQuiz', 'getQuizResult'
];

const methodsToRemoveFromQuiz = [
  'createModule', 'updateModule', 'getAdminModules', 'toggleModuleStatus', 'getAdminModuleDetail',
  'getModules', 'getCareHomeTopics', 'getMyCareChildren', 'getSuggestedModules', 'getModuleDetail', 'saveModule', 'removeSavedModule', 'assignModuleToNannies', 'getCareHome', 'getCareHomeTabs',
  'getChildInsights', 'getMonthlyHighlights', 'getChildNotes', 'createChildNote', 'deleteChildNote'
];

function processFile(filePath: string, className: string, methodsToRemove: string[]) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    console.error(`Could not find file ${filePath}`);
    return;
  }
  const cls = sourceFile.getClass(className);
  if (!cls) {
    console.error(`Could not find class ${className} in ${filePath}`);
    return;
  }
  let removedCount = 0;
  for (const methodName of methodsToRemove) {
    const method = cls.getMethod(methodName);
    if (method) {
      method.remove();
      removedCount++;
    } else {
      console.warn(`Method ${methodName} not found in ${className}`);
    }
  }
  console.log(`Removed ${removedCount} methods from ${className}`);
}

processFile('src/modules/care/services/carehub.service.ts', 'CarehubService', methodsToRemoveFromCarehub);
processFile('src/modules/care/services/carehub-insights.service.ts', 'CarehubInsightsService', methodsToRemoveFromInsights);
processFile('src/modules/care/services/carehub-quiz.service.ts', 'CarehubQuizService', methodsToRemoveFromQuiz);

project.saveSync();
console.log('Done!');
