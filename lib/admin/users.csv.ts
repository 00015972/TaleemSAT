import type { UserDirectoryRow } from './users.types';

function spreadsheetSafe(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: string | number | null): string {
  const text = spreadsheetSafe(value === null ? '' : String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

export function usersToCsv(rows: UserDirectoryRow[]): string {
  const headers = [
    'User ID',
    'Full name',
    'Email',
    'Role',
    'Tier',
    'Subscription status',
    'Joined',
    'Last active',
    'Attempts (7d)',
    'Total attempts',
    'Accuracy (%)',
  ];
  const body = rows.map(row =>
    [
      row.id,
      row.fullName,
      row.email,
      row.role,
      row.tier,
      row.subscriptionStatus,
      row.createdAt,
      row.lastActiveAt,
      row.attempts7d,
      row.totalAttempts,
      row.accuracy,
    ]
      .map(csvCell)
      .join(',')
  );
  return `\uFEFF${[headers.map(csvCell).join(','), ...body].join('\r\n')}\r\n`;
}
