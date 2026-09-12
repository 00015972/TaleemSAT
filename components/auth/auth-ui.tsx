'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { AuthArt, type AuthArtVariant } from '@/components/auth/auth-art';

export function AuthStage({
  art,
  signupStep,
  children,
  size = 'default',
}: {
  art: AuthArtVariant;
  signupStep?: 1 | 2;
  children: ReactNode;
  size?: 'default' | 'wide';
}) {
  return (
    <section className={`auth-stage ${size === 'wide' ? 'auth-stage-wide' : ''}`}>
      <AuthArt variant={art} signupStep={signupStep} />
      <div className="auth-panel">{children}</div>
    </section>
  );
}

export function AuthPanelHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="auth-panel-header">
      <p className="auth-kicker"><span />{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function AuthAlert({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} role="alert" className="auth-alert">
      <AlertCircle size={17} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function AuthInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`auth-input ${className}`} {...props} />;
}

export function AuthPasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-password-wrap">
      <AuthInput
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        required
        minLength={autoComplete === 'new-password' ? 8 : undefined}
        maxLength={autoComplete === 'new-password' ? 128 : undefined}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setVisible(current => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function AuthSubmitButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button type="submit" disabled={loading} className="auth-primary-button">
      <span>{loading ? loadingLabel : label}</span>
      {loading ? (
        <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" />
      ) : (
        <ArrowRight size={17} aria-hidden="true" />
      )}
    </button>
  );
}
