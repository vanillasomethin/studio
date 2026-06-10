'use client';
import { ErrorCategory, ERROR_COPY } from '@/lib/api-client';

// Premium inline error/empty/loading states.
// Use inside cards, tables, any content area that can fail.

type Variant = 'error' | 'empty' | 'loading' | 'offline' | 'maintenance';

type Props = {
  variant?: Variant;
  category?: ErrorCategory;
  title?: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  retryIn?: number | null;
  retryCount?: number;
  compact?: boolean;       // smaller version for tight spaces
  className?: string;
};

const MONO: React.CSSProperties = {
  fontFamily: '"DM Mono", ui-monospace, monospace',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  fontWeight: 600,
};

export function ErrorState({
  variant = 'error', category, title, body, action, onAction,
  retryIn, retryCount, compact = false, className = '',
}: Props) {
  const copy = category ? ERROR_COPY[category] : null;
  const displayTitle  = title  ?? copy?.title  ?? 'Something went wrong';
  const displayBody   = body   ?? copy?.body   ?? 'Please try again.';
  const displayAction = action ?? copy?.action;

  const size = compact ? { wrapper: 48, icon: 28 } : { wrapper: 80, icon: 40 };

  return (
    <div
      className={className}
      role="status"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: compact ? 10 : 16,
        padding: compact ? '24px 16px' : '48px 24px',
        textAlign: 'center',
        animation: 'errorIn .22s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <style>{`@keyframes errorIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* Geometric icon — no illustrations, just shapes */}
      <div style={{
        width: size.wrapper, height: size.wrapper, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: iconBg(variant),
      }}>
        <Icon variant={variant} size={size.icon} />
      </div>

      {/* Copy */}
      <div style={{ maxWidth: compact ? 200 : 280 }}>
        <p style={{
          fontFamily: '"Manrope", sans-serif', fontWeight: 700,
          fontSize: compact ? 13 : 15, color: '#0a0a0a', lineHeight: 1.3, margin: '0 0 6px',
        }}>
          {displayTitle}
        </p>
        <p style={{
          fontFamily: '"Manrope", sans-serif', fontSize: compact ? 11 : 13,
          color: '#737373', lineHeight: 1.55, margin: 0,
        }}>
          {displayBody}
        </p>

        {/* Retry countdown */}
        {(retryIn || retryCount) && (
          <p style={{ ...MONO, fontSize: 10, color: '#a3a3a3', marginTop: 8 }}>
            {retryIn ? `Retrying in ${retryIn}s` : retryCount ? `Retried ${retryCount}×` : ''}
          </p>
        )}
      </div>

      {/* Action */}
      {displayAction && onAction && (
        <button
          onClick={onAction}
          style={{
            fontFamily: '"Manrope", sans-serif', fontWeight: 600,
            fontSize: compact ? 11 : 12,
            padding: compact ? '7px 14px' : '9px 18px',
            borderRadius: 999, border: '1px solid #e5e5e5',
            background: '#fff', cursor: 'pointer', color: '#0a0a0a',
            transition: 'background .15s, border-color .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          {displayAction}
        </button>
      )}
    </div>
  );
}

// Loading skeleton variant — used while initial data loads
export function LoadingSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={className} style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .skeleton-line{border-radius:4px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:800px 100%;animation:shimmer 1.4s ease infinite;}
      `}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ height: 14, width: `${[85, 65, 75][i % 3]}%`, opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

// Compact inline retry prompt — for inline form errors
export function RetryPrompt({ message, onRetry, retryIn }: { message: string; onRetry: () => void; retryIn?: number | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      background: '#fef2f2', border: '1px solid #fecaca',
      fontFamily: '"Manrope", sans-serif', fontSize: 12,
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="6" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1" />
        <path d="M7 4v3.5M7 9v.01" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span style={{ color: '#991b1b', flex: 1 }}>{message}</span>
      {retryIn ? (
        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#b91c1c' }}>Retrying in {retryIn}s</span>
      ) : (
        <button onClick={onRetry} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 600, fontSize: 12, padding: 0 }}>
          Try again
        </button>
      )}
    </div>
  );
}

function iconBg(v: Variant) {
  if (v === 'error')       return '#fef2f2';
  if (v === 'offline')     return '#fefce8';
  if (v === 'maintenance') return '#f0f9ff';
  if (v === 'empty')       return '#f5f5f5';
  return '#f5f5f5';
}

function Icon({ variant, size }: { variant: Variant; size: number }) {
  const s = size;
  if (variant === 'loading') {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14" fill="none" stroke="#e5e5e5" strokeWidth="3" />
        <path d="M20 6 A14 14 0 0 1 34 20" fill="none" stroke="#a3a3a3" strokeWidth="3" strokeLinecap="round"
          style={{ animation: 'spin .9s linear infinite', transformOrigin: '20px 20px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </svg>
    );
  }
  if (variant === 'empty') {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <rect x="10" y="14" width="20" height="16" rx="2" stroke="#d4d4d4" strokeWidth="1.5" />
        <path d="M14 14v-2a6 6 0 0 1 12 0v2" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="22" r="2" fill="#d4d4d4" />
      </svg>
    );
  }
  if (variant === 'offline') {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <path d="M8 8l24 24M16 16a12 12 0 0 1 14.4 3.6M11 11A18 18 0 0 1 31 17M20 28v.01" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'maintenance') {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
        <path d="M20 10v5M20 25v5M10 20h5M25 20h5M14.1 14.1l3.5 3.5M22.4 22.4l3.5 3.5M14.1 25.9l3.5-3.5M22.4 17.6l3.5-3.5" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="20" cy="20" r="4" fill="#bae6fd" />
      </svg>
    );
  }
  // error default
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none">
      <path d="M20 14v8M20 26v.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
