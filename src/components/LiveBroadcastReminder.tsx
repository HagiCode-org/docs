import styles from './LiveBroadcastReminder.module.css';

import { LIVE_BROADCAST_PROFILE_URL, LIVE_BROADCAST_QR_IMAGE_URL } from '@/lib/live-broadcast';
import type { LiveBroadcastLocale, LiveBroadcastState } from '@/lib/live-broadcast';

interface LiveBroadcastReminderProps {
  locale: LiveBroadcastLocale;
  state: LiveBroadcastState;
  previewCopy: string;
  liveCopy: string;
  qrAlt: string;
  qrFallbackLabel: string;
  qrAvailable: boolean;
  onQrError?: () => void;
}

export default function LiveBroadcastReminder({
  locale,
  state,
  previewCopy,
  liveCopy,
  qrAlt,
  qrFallbackLabel,
  qrAvailable,
  onQrError,
}: LiveBroadcastReminderProps) {
  if (state === 'offline') {
    return null;
  }

  const body = state === 'live' ? liveCopy : previewCopy;
  const label = locale === 'zh-CN'
    ? state === 'live' ? 'Hagicode 现场直播' : '文档页开播提醒'
    : state === 'live' ? 'Docs live reminder' : 'Docs preview reminder';

  return (
    <aside className={styles.reminder} aria-live="polite" data-docs-live-reminder={state}>
      <div className={styles.shell}>
        <a className={styles.contentLink} href={LIVE_BROADCAST_PROFILE_URL} target="_blank" rel="noreferrer">
          <div className={styles.copy}>
            <div className={styles.badge}>{label}</div>
            <p className={styles.body}>{body}</p>
          </div>
        </a>

        <a className={styles.qrFrame} href={LIVE_BROADCAST_QR_IMAGE_URL} target="_blank" rel="noreferrer" aria-label={qrAlt}>
          {qrAvailable ? (
            <img
              className={styles.qrImage}
              src={LIVE_BROADCAST_QR_IMAGE_URL}
              alt={qrAlt}
              width={96}
              height={96}
              loading="lazy"
              onError={onQrError}
            />
          ) : (
            <span className={styles.qrFallback}>{qrFallbackLabel}</span>
          )}
        </a>
      </div>
    </aside>
  );
}
