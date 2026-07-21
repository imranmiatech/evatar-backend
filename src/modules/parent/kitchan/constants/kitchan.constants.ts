export const KITCHEN_ITEM_CATEGORIES = [
  'PRODUCE',
  'DAIRY',
  'PANTRY',
  'PROTEIN',
  'BABY_FOOD',
  'SNACK',
  'OTHER',
] as const;

export const KITCHEN_INVENTORY_STATUSES = [
  'MISSING',
  'LOW',
  'IN_STOCK',
] as const;

export const SHOPPING_LIST_ITEM_STATUSES = [
  'NEEDED',
  'OPTIONAL',
  'ADDED_TO_VOUCHER',
  'ORDERED',
  'FULFILLED',
  'REMOVED',
] as const;

export const RECIPE_MEAL_TYPES = [
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK',
  'OTHER',
] as const;

export const PAYMENT_METHOD_TYPES = [
  'CARD',
  'CASH_ON_DELIVERY',
  'ONLINE',
] as const;

