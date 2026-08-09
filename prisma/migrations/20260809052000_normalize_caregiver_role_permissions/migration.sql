-- Keep caregiver access permissions aligned with the role-specific mobile permission sheets.
UPDATE "CaregiverAccess"
SET
  "dailyActivitiesRecipes" = false,
  "manageGroceryLists" = true,
  "addRemoveChildren" = false,
  "manageBilling" = false,
  "manageCareTeam" = false,
  "manageGroceryOrders" = false,
  "groceryOrdering" = false,
  "careLearningAccess" = false,
  "nannyDevelopment" = false,
  "memoriesStories" = false
WHERE "role" = 'NANNY';

UPDATE "CaregiverAccess"
SET
  "dailyActivitiesRecipes" = false,
  "manageDailyPlans" = true,
  "manageGroceryLists" = false,
  "editChildProfile" = false,
  "accessChildInsights" = false,
  "manageCareTeam" = true,
  "groceryOrdering" = false,
  "careLearningAccess" = false,
  "nannyDevelopment" = false,
  "memoriesStories" = false
WHERE "role" = 'PARENT';

UPDATE "CaregiverAccess"
SET
  "dailyActivitiesRecipes" = true,
  "editChildProfile" = false,
  "accessChildInsights" = true,
  "addRemoveChildren" = false,
  "manageBilling" = false,
  "manageGroceryOrders" = false,
  "careLearningAccess" = true,
  "memoriesStories" = true
WHERE "role" = 'FAMILY_MEMBER';
