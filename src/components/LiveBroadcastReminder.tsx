import styles from './LiveBroadcastReminder.module.css';

import type { LiveBroadcastLocale, LiveBroadcastState } from '@/lib/live-broadcast';

interface LiveBroadcastReminderProps {
  locale: LiveBroadcastLocale;
  state: LiveBroadcastState;
  previewCopy: string;
  liveCopy: string;
}

export default function LiveBroadcastReminder({
  locale,
  state,
  previewCopy,
  liveCopy,
}: LiveBroadcastReminderProps) {
  if (state === 'offline') {
    return null;
  }

  const body = state === 'live' ? liveCopy : previewCopy;
  const label = locale === 'zh-CN'
    ? state === 'live' ? '文档页直播提醒' : '文档页开播提醒'
    : state === 'live' ? 'Docs live reminder' : 'Docs preview reminder';

  return (
    <aside className={styles.reminder} aria-live="polite" data-docs-live-reminder={state}>
      <div className={styles.shell}>
        <div className={styles.badge}>{label}</div>
        <p className={styles.body}>{body}</p>
      </div>
    </aside>
  );
}
