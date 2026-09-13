import type {
  AdminUserRole,
  AdminUserTier,
  UsersFilters,
  UsersSegment,
  UsersSort,
} from './users.types';

export const USERS_PAGE_SIZE = 50;
export const USERS_EXPORT_LIMIT = 10_000;
export const USERS_SEARCH_MAX_LENGTH = 200;

type SearchValue = string | string[] | undefined;
export type UsersSearchParams = Record<string, SearchValue>;

const ROLES = new Set<AdminUserRole>(['student', 'admin']);
const TIERS = new Set<AdminUserTier>(['free', 'pro', 'elite']);
const SEGMENTS = new Set<UsersSegment>([
  '',
  'attention',
  'renewal-risk',
  'inactive-paid',
  'recent-upgrade',
]);
const SORTS = new Set<UsersSort>([
  'newest',
  'oldest',
  'recent-activity',
  'lowest-accuracy',
]);

function scalar(value: SearchValue): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export function parseUsersSearchParams(input: UsersSearchParams): UsersFilters {
  const q = scalar(input.q).trim().slice(0, USERS_SEARCH_MAX_LENGTH);
  const roleCandidate = scalar(input.role) as AdminUserRole;
  const tierCandidate = scalar(input.tier) as AdminUserTier;
  const segmentCandidate = scalar(input.segment) as UsersSegment;
  const sortCandidate = scalar(input.sort) as UsersSort;
  const parsedPage = Number.parseInt(scalar(input.page), 10);

  return {
    q,
    role: ROLES.has(roleCandidate) ? roleCandidate : '',
    tier: TIERS.has(tierCandidate) ? tierCandidate : '',
    segment: SEGMENTS.has(segmentCandidate) ? segmentCandidate : '',
    sort: SORTS.has(sortCandidate) ? sortCandidate : 'newest',
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function usersFiltersToSearchParams(
  filters: UsersFilters,
  options: { includePage?: boolean } = {}
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.role) params.set('role', filters.role);
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.segment) params.set('segment', filters.segment);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (options.includePage && filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export function hasActiveUsersFilters(filters: UsersFilters): boolean {
  return Boolean(
    filters.q ||
      filters.role ||
      filters.tier ||
      filters.segment ||
      filters.sort !== 'newest'
  );
}
