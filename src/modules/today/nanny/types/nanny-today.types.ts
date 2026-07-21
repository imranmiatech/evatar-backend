export type TimelineItemType = 'routine' | 'activity' | 'story';

export interface TimelineItem {
  type: TimelineItemType;
  id: string;
  activityId?: string;
  storyId?: string;
  category: string;
  title: string;
  subtitle?: string | null;
  timeLabel?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  status?: string;
  imageUrl?: string | null;
  hasRecipe: boolean;
  recipeId?: string | null;
  proofRequired: boolean;
  proofMediaId?: string | null;
  sortOrder: number;
}
