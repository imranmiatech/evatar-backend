export interface FormattedNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  iconType: string;
  avatarUrl?: string | null;
  actionText?: string | null;
  actionUrl?: string | null;
  timeAgo: string;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
}

export interface GroupedNotificationsResponse {
  unreadCount: number;
  totalCount: number;
  groups: {
    today: FormattedNotificationItem[];
    thisWeek: FormattedNotificationItem[];
    older: FormattedNotificationItem[];
  };
}

export function formatTimeAgo(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return 'Last Week';
}

export function groupNotifications(notifications: any[]): GroupedNotificationsResponse {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayItems: FormattedNotificationItem[] = [];
  const thisWeekItems: FormattedNotificationItem[] = [];
  const olderItems: FormattedNotificationItem[] = [];

  let unreadCount = 0;

  notifications.forEach((item) => {
    if (!item.isRead) {
      unreadCount++;
    }

    const itemDate = new Date(item.createdAt);
    const formattedItem: FormattedNotificationItem = {
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      iconType: item.iconType || getDefaultIconForType(item.type),
      avatarUrl: item.avatarUrl,
      actionText: item.actionText || getDefaultActionTextForType(item.type),
      actionUrl: item.actionUrl,
      timeAgo: formatTimeAgo(item.createdAt),
      isRead: item.isRead,
      metadata: item.metadata,
      createdAt: item.createdAt,
    };

    if (itemDate >= startOfToday) {
      todayItems.push(formattedItem);
    } else if (itemDate >= sevenDaysAgo) {
      thisWeekItems.push(formattedItem);
    } else {
      olderItems.push(formattedItem);
    }
  });

  return {
    unreadCount,
    totalCount: notifications.length,
    groups: {
      today: todayItems,
      thisWeek: thisWeekItems,
      older: olderItems,
    },
  };
}

function getDefaultIconForType(type: string): string {
  switch (type) {
    case 'ACTIVITY_COMPLETED': return 'CHECK';
    case 'NUTRITION_COMPLETED': return 'FOOD';
    case 'NEW_MESSAGE': return 'CHAT';
    case 'GROCERY_DELIVERED': return 'CART';
    case 'STORY_SAVED': return 'BOOK';
    case 'CARE_MODULE_COMPLETED': return 'BOOKMARK';
    case 'INVITATION_ACCEPTED': return 'AVATAR';
    case 'PARTNER_OFFER': return 'GIFT';
    case 'WEEKLY_INSIGHT': return 'INSIGHT';
    default: return 'BELL';
  }
}

function getDefaultActionTextForType(type: string): string {
  switch (type) {
    case 'ACTIVITY_COMPLETED': return 'View Activity >';
    case 'NUTRITION_COMPLETED': return 'View Nutrition >';
    case 'NEW_MESSAGE': return 'Open Chat';
    case 'GROCERY_DELIVERED': return 'View Order >';
    case 'STORY_SAVED': return 'Read Story >';
    case 'CARE_MODULE_COMPLETED': return 'View Progress >';
    case 'INVITATION_ACCEPTED': return 'Manage Access';
    case 'PARTNER_OFFER': return 'View Offer >';
    case 'WEEKLY_INSIGHT': return 'View Insights >';
    default: return 'View >';
  }
}
