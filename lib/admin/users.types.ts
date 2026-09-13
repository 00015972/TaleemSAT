export type AdminUserRole = 'student' | 'admin';
export type AdminUserTier = 'free' | 'pro' | 'elite';
export type AdminSubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing';

export type UsersSegment =
  | ''
  | 'attention'
  | 'renewal-risk'
  | 'inactive-paid'
  | 'recent-upgrade';

export type UsersSort = 'newest' | 'oldest' | 'recent-activity' | 'lowest-accuracy';

export type UsersFilters = {
  q: string;
  role: '' | AdminUserRole;
  tier: '' | AdminUserTier;
  segment: UsersSegment;
  sort: UsersSort;
  page: number;
};

export type UsersWorkspaceSummary = {
  totalUsers: number;
  paidAccess: number;
  weeklyActive: number;
  needsAttention: number;
  workspaceHealth: number;
  renewalRisk: number;
  inactivePaid: number;
  recentUpgrades: number;
};

export type UserDirectoryRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminUserRole;
  tier: AdminUserTier;
  createdAt: string;
  subscriptionStatus: AdminSubscriptionStatus | null;
  lastActiveAt: string | null;
  attempts7d: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number | null;
  dailyActivity: number[];
};

export type AdminUserNote = {
  id: string;
  body: string;
  createdAt: string;
  authorUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
};

export type AdminUserRecentAttempt = {
  id: string;
  questionId: string;
  questionPreview: string;
  sourceRef: string | null;
  isCorrect: boolean;
  context: 'practice' | 'mock';
  createdAt: string;
};

export type AdminUserCertificate = {
  id: string;
  tier: number;
  awardedAt: string;
  pdfUrl: string | null;
};

export type AdminUserBilling = {
  provider: 'stripe' | 'payme' | null;
  status: AdminSubscriptionStatus | null;
  tier: AdminUserTier;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  fullName: string | null;
  role: AdminUserRole;
  tier: AdminUserTier;
  timezone: string;
  targetSatScore: number | null;
  examDate: string | null;
  marketingOptIn: boolean;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  createdAt: string;
  billing: AdminUserBilling;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number | null;
  lastActiveAt: string | null;
  recentAttempts: AdminUserRecentAttempt[];
  certificates: AdminUserCertificate[];
  notes: AdminUserNote[];
};

export type UsersPagePayload = {
  users: UserDirectoryRow[];
  summary: UsersWorkspaceSummary | null;
  total: number;
  totalPages: number;
  filters: UsersFilters;
  summaryError: boolean;
  directoryError: boolean;
};
