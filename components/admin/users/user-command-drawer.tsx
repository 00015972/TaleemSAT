'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  FiActivity,
  FiAlertCircle,
  FiAward,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiExternalLink,
  FiFileText,
  FiMail,
  FiRefreshCw,
  FiShield,
  FiTarget,
  FiUser,
  FiX,
  FiZap,
} from 'react-icons/fi';
import type {
  AdminUserDetail,
  AdminUserRole,
  AdminUserTier,
  UserDirectoryRow,
} from '@/lib/admin/users.types';

type DrawerTab = 'overview' | 'billing' | 'activity' | 'notes';
type Feedback = { kind: 'success' | 'error'; text: string } | null;

const ERROR_MESSAGES: Record<string, string> = {
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  LAST_ADMIN: 'This is the final admin account. Promote another admin first.',
  USER_NOT_FOUND: 'This learner no longer exists.',
  UPDATE_FAILED: 'The account change could not be saved.',
  NOTE_CREATE_FAILED: 'The note could not be saved.',
  RESET_FAILED: 'The recovery email could not be requested.',
};

export function UserCommandDrawer({
  user,
  detail,
  loading,
  error,
  currentUserId,
  onClose,
  onRetry,
  onDetailChange,
  onRefresh,
}: {
  user: UserDirectoryRow;
  detail: AdminUserDetail | null;
  loading: boolean;
  error: boolean;
  currentUserId: string;
  onClose: () => void;
  onRetry: () => void;
  onDetailChange: (detail: AdminUserDetail) => void;
  onRefresh: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [noteBody, setNoteBody] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  async function responseError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => ({}));
    return ERROR_MESSAGES[payload?.error] ?? fallback;
  }

  async function saveAccount(patch: { role?: AdminUserRole; tier?: AdminUserTier }) {
    if (!detail) return;
    const label = detail.fullName || detail.email;
    const confirmation = patch.role
      ? patch.role === 'admin'
        ? `Grant administrator access to ${label}? They will be able to manage content and users.`
        : `Remove administrator access from ${label}?`
      : patch.tier && patch.tier !== 'free'
        ? `Grant ${patch.tier.toUpperCase()} access to ${label}?`
        : `Move ${label} to the Free tier?`;
    if (!window.confirm(confirmation)) return;

    const kind = patch.role ? 'role' : 'tier';
    setBusy(kind);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        setFeedback({ kind: 'error', text: await responseError(response, 'The account change could not be saved.') });
        return;
      }
      onDetailChange({ ...detail, ...patch });
      setFeedback({ kind: 'success', text: `${kind === 'role' ? 'Role' : 'Tier'} updated.` });
      onRefresh();
    } catch {
      setFeedback({ kind: 'error', text: 'Network error. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function requestReset() {
    if (!detail || !window.confirm(`Send a password recovery email to ${detail.email}?`)) return;
    setBusy('reset');
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${detail.id}/password-reset`, { method: 'POST' });
      if (!response.ok) {
        setFeedback({ kind: 'error', text: await responseError(response, 'The recovery email could not be requested.') });
        return;
      }
      setFeedback({ kind: 'success', text: 'Recovery email requested successfully.' });
    } catch {
      setFeedback({ kind: 'error', text: 'Network error. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !noteBody.trim()) return;
    setBusy('note');
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${detail.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody }),
      });
      if (!response.ok) {
        setFeedback({ kind: 'error', text: await responseError(response, 'The note could not be saved.') });
        return;
      }
      const payload = await response.json();
      if (payload.note) onDetailChange({ ...detail, notes: [payload.note, ...detail.notes] });
      setNoteBody('');
      setFeedback({ kind: 'success', text: 'Internal note added.' });
    } catch {
      setFeedback({ kind: 'error', text: 'Network error. Your note is still in the editor.' });
    } finally {
      setBusy(null);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ kind: 'success', text: `${label} copied.` });
    } catch {
      setFeedback({ kind: 'error', text: `Could not copy ${label.toLowerCase()}.` });
    }
  }

  const initials = getInitials(user.fullName || user.email);
  const name = user.fullName || 'Unnamed learner';

  return (
    <div
      className="users-drawer-scrim"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside ref={panelRef} className="users-drawer" role="dialog" aria-modal="true" aria-labelledby="users-drawer-title">
        <header className="users-drawer-header">
          <div className={`users-drawer-avatar tier-${user.tier}`}>{initials}</div>
          <div>
            <span className="users-drawer-eyebrow">User command</span>
            <h2 id="users-drawer-title">{name}</h2>
            <p>{user.email}</p>
          </div>
          <button ref={closeButtonRef} type="button" className="users-drawer-close" onClick={onClose} aria-label="Close user details">
            <FiX aria-hidden="true" />
          </button>
        </header>

        <nav className="users-drawer-tabs" aria-label="User detail sections">
          {([
            ['overview', 'Overview', FiUser],
            ['billing', 'Billing', FiCreditCard],
            ['activity', 'Activity', FiActivity],
            ['notes', 'Notes', FiFileText],
          ] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" className={tab === value ? 'is-active' : undefined} onClick={() => setTab(value)}>
              <Icon aria-hidden="true" /> {label}
              {value === 'notes' && detail && detail.notes.length > 0 && <span>{detail.notes.length}</span>}
            </button>
          ))}
        </nav>

        <div className="users-drawer-body">
          {loading ? (
            <DrawerSkeleton />
          ) : error ? (
            <div className="users-drawer-state">
              <FiAlertCircle aria-hidden="true" />
              <h3>User details are out of range</h3>
              <p>The directory is still available. Retry this record or close the drawer.</p>
              <button type="button" onClick={onRetry}><FiRefreshCw aria-hidden="true" /> Retry details</button>
            </div>
          ) : detail ? (
            <>
              {tab === 'overview' && <OverviewTab detail={detail} onCopy={copy} />}
              {tab === 'billing' && <BillingTab detail={detail} />}
              {tab === 'activity' && <ActivityTab detail={detail} />}
              {tab === 'notes' && (
                <NotesTab detail={detail} noteBody={noteBody} busy={busy === 'note'} onChange={setNoteBody} onSubmit={addNote} />
              )}
            </>
          ) : null}
        </div>

        {detail && !loading && !error && (
          <footer className="users-drawer-footer">
            <div className="users-drawer-account-controls">
              <label>
                <span>Role</span>
                <select
                  value={detail.role}
                  disabled={detail.id === currentUserId || busy !== null}
                  title={detail.id === currentUserId ? "You can't change your own role" : undefined}
                  onChange={event => saveAccount({ role: event.target.value as AdminUserRole })}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                <span>Tier</span>
                <select value={detail.tier} disabled={busy !== null} onChange={event => saveAccount({ tier: event.target.value as AdminUserTier })}>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
              </label>
            </div>
            <div className="users-drawer-actions">
              <button type="button" onClick={() => copy(detail.email, 'Email')}><FiCopy aria-hidden="true" /> Copy email</button>
              <button type="button" onClick={requestReset} disabled={busy !== null}><FiMail aria-hidden="true" />{busy === 'reset' ? 'Requesting…' : 'Send reset link'}</button>
            </div>
          </footer>
        )}

        <div className="users-drawer-live" aria-live={feedback?.kind === 'error' ? 'assertive' : 'polite'}>
          {feedback && (
            <p className={feedback.kind}>
              {feedback.kind === 'success' ? <FiCheck aria-hidden="true" /> : <FiAlertCircle aria-hidden="true" />}
              {feedback.text}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function OverviewTab({
  detail,
  onCopy,
}: {
  detail: AdminUserDetail;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <div className="users-drawer-section users-drawer-section-enter">
      <div className="users-drawer-health">
        <div>
          <span><FiZap aria-hidden="true" /></span>
          <div><small>Learning health</small><strong>{healthLabel(detail)}</strong></div>
        </div>
        <p>{healthCopy(detail)}</p>
      </div>
      <div className="users-drawer-stat-grid">
        <DrawerStat icon={FiTarget} label="Target score" value={detail.targetSatScore?.toString() ?? 'Not set'} />
        <DrawerStat icon={FiActivity} label="Accuracy" value={detail.accuracy === null ? 'No attempts' : `${detail.accuracy}%`} />
        <DrawerStat icon={FiZap} label="Current streak" value={`${detail.currentStreak} day${detail.currentStreak === 1 ? '' : 's'}`} />
        <DrawerStat icon={FiAward} label="Total XP" value={detail.totalXp.toLocaleString('en-US')} />
      </div>
      <div className="users-drawer-info-list">
        <InfoRow icon={FiCalendar} label="Exam date" value={formatDate(detail.examDate)} />
        <InfoRow icon={FiClock} label="Joined" value={formatDate(detail.createdAt)} />
        <InfoRow icon={FiMail} label="Marketing email" value={detail.marketingOptIn ? 'Opted in' : 'Opted out'} />
        <InfoRow icon={FiClipboard} label="User ID" value={detail.id} action={() => onCopy(detail.id, 'User ID')} />
      </div>
    </div>
  );
}

function BillingTab({ detail }: { detail: AdminUserDetail }) {
  const billing = detail.billing;
  const stripeUrl = billing.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${encodeURIComponent(billing.stripeCustomerId)}`
    : null;

  return (
    <div className="users-drawer-section users-drawer-section-enter">
      <div className={`users-drawer-plan tier-${detail.tier}`}>
        <span><FiCreditCard aria-hidden="true" /></span>
        <div>
          <small>Current access</small>
          <strong>{detail.tier}</strong>
          <p>{billing.provider ? `Managed through ${billing.provider}` : 'Direct workspace access'}</p>
        </div>
        <i>{formatStatus(billing.status)}</i>
      </div>
      <div className="users-drawer-info-list">
        <InfoRow icon={FiShield} label="Status" value={formatStatus(billing.status)} />
        <InfoRow icon={FiCalendar} label="Period end" value={formatDate(billing.currentPeriodEnd)} />
        <InfoRow icon={FiRefreshCw} label="Renewal" value={billing.cancelAtPeriodEnd ? 'Cancels at period end' : 'Continues automatically'} />
      </div>
      {stripeUrl ? (
        <a className="users-drawer-external" href={stripeUrl} target="_blank" rel="noreferrer">
          Open Stripe customer <FiExternalLink aria-hidden="true" />
        </a>
      ) : (
        <p className="users-drawer-muted-note">No Stripe customer is linked to this account.</p>
      )}
    </div>
  );
}

function ActivityTab({ detail }: { detail: AdminUserDetail }) {
  return (
    <div className="users-drawer-section users-drawer-section-enter">
      <div className="users-drawer-stat-grid three">
        <DrawerStat icon={FiActivity} label="Attempts" value={detail.totalAttempts.toLocaleString('en-US')} />
        <DrawerStat icon={FiCheckCircle} label="Correct" value={detail.correctAttempts.toLocaleString('en-US')} />
        <DrawerStat icon={FiTarget} label="Accuracy" value={detail.accuracy === null ? '—' : `${detail.accuracy}%`} />
      </div>
      <SectionHeading icon={FiActivity} title="Recent attempts" copy="Latest learning evidence" />
      {detail.recentAttempts.length === 0 ? (
        <p className="users-drawer-muted-note">No practice or mock attempts yet.</p>
      ) : (
        <div className="users-drawer-attempts">
          {detail.recentAttempts.map(attempt => (
            <Link key={attempt.id} href={`/admin/questions/${attempt.questionId}/edit`}>
              <span className={attempt.isCorrect ? 'correct' : 'incorrect'}>
                {attempt.isCorrect ? <FiCheck aria-hidden="true" /> : <FiX aria-hidden="true" />}
              </span>
              <div>
                <strong>{attempt.sourceRef || attempt.questionPreview}</strong>
                <p>{attempt.sourceRef ? attempt.questionPreview : `${attempt.context} attempt`}</p>
              </div>
              <time>{formatDate(attempt.createdAt)}</time>
            </Link>
          ))}
        </div>
      )}
      {detail.certificates.length > 0 && (
        <>
          <SectionHeading icon={FiAward} title="Certificates" copy="Earned milestones" />
          <div className="users-drawer-certificates">
            {detail.certificates.map(certificate => (
              <span key={certificate.id}>
                <FiAward aria-hidden="true" />
                <strong>{certificate.tier}</strong>
                <small>{formatDate(certificate.awardedAt)}</small>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NotesTab({
  detail,
  noteBody,
  busy,
  onChange,
  onSubmit,
}: {
  detail: AdminUserDetail;
  noteBody: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="users-drawer-section users-drawer-section-enter">
      <form className="users-drawer-note-form" onSubmit={onSubmit}>
        <label htmlFor="admin-user-note">Add an internal note</label>
        <textarea
          id="admin-user-note"
          value={noteBody}
          maxLength={2000}
          onChange={event => onChange(event.target.value)}
          placeholder="Record support context, a promised follow-up, or an account detail…"
        />
        <div>
          <span>{noteBody.length.toLocaleString('en-US')} / 2,000</span>
          <button type="submit" disabled={busy || !noteBody.trim()}>
            <FiFileText aria-hidden="true" />{busy ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </form>
      <div className="users-drawer-notes">
        {detail.notes.length === 0 ? (
          <p className="users-drawer-muted-note">No internal notes have been added.</p>
        ) : (
          detail.notes.map(note => (
            <article key={note.id}>
              <p>{note.body}</p>
              <footer>
                <span>{note.authorName || note.authorEmail || 'Former administrator'}</span>
                <time>{formatDate(note.createdAt)}</time>
              </footer>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function DrawerStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FiActivity;
  label: string;
  value: string;
}) {
  return (
    <div className="users-drawer-stat">
      <span><Icon aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof FiActivity;
  label: string;
  value: string;
  action?: () => void;
}) {
  return (
    <div className="users-drawer-info">
      <span><Icon aria-hidden="true" /></span>
      <small>{label}</small>
      <strong title={value}>{value}</strong>
      {action && <button type="button" onClick={action} aria-label={`Copy ${label}`}><FiCopy aria-hidden="true" /></button>}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof FiActivity;
  title: string;
  copy: string;
}) {
  return (
    <div className="users-drawer-subhead">
      <span><Icon aria-hidden="true" /></span>
      <div><h3>{title}</h3><p>{copy}</p></div>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="users-drawer-skeleton" aria-label="Loading user details">
      <span /><span /><span />
      <div><i /><i /><i /><i /></div>
      <span /><span />
    </div>
  );
}

function getInitials(value: string) {
  return (
    value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

function formatDate(value: string | null): string {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatus(value: AdminUserDetail['billing']['status']): string {
  if (!value) return 'No subscription';
  return value.replace('_', ' ').replace(/^./, character => character.toUpperCase());
}

function healthLabel(detail: AdminUserDetail): string {
  if (detail.totalAttempts === 0) return 'New signal';
  if (detail.billing.status === 'past_due' || detail.billing.status === 'incomplete') return 'Needs attention';
  if (detail.accuracy !== null && detail.accuracy >= 75) return 'Building momentum';
  return 'Developing rhythm';
}

function healthCopy(detail: AdminUserDetail): string {
  if (detail.totalAttempts === 0) {
    return 'No attempts yet. This learner is ready for a clear first practice path.';
  }
  if (detail.billing.status === 'past_due' || detail.billing.status === 'incomplete') {
    return 'Learning history is available, but billing needs an administrator’s attention.';
  }
  if (detail.accuracy !== null && detail.accuracy >= 75) {
    return `${detail.correctAttempts} correct answers across ${detail.totalAttempts} attempts show a strong learning rhythm.`;
  }
  return `${detail.totalAttempts} attempts provide enough evidence to guide the next focused practice session.`;
}
