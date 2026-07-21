export interface ActivityPermissions {
  canEdit: boolean;
  canUpdateProof: boolean;
  canViewStory: boolean;
}

export interface ActivitySummary {
  planned: number;
  inProgress: number;
  completed: number;
  skipped: number;
  total: number;
}
