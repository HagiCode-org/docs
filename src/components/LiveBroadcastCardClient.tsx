import { useEffect, useState } from 'react';

import {
  LIVE_BROADCAST_REFRESH_MS,
  LIVE_BROADCAST_QR_IMAGE_URL,
  getLiveBroadcastRuntime,
  loadLiveBroadcastData,
  type LiveBroadcastData,
  type LiveBroadcastLocale,
  type LiveBroadcastRuntime,
} from '@/lib/live-broadcast';
import LiveBroadcastReminder from './LiveBroadcastReminder';
import styles from './LiveBroadcastCard.module.css';

interface LiveBroadcastCardClientProps {
  locale: LiveBroadcastLocale;
  initialData?: LiveBroadcastData | null;
}

interface LiveBroadcastCardBodyProps {
  data: LiveBroadcastData;
  locale: LiveBroadcastLocale;
  runtime: LiveBroadcastRuntime;
  qrAvailable: boolean;
  onQrError?: () => void;
}

export function LiveBroadcastCardBody({
  data,
  locale,
  runtime,
  qrAvailable,
  onQrError,
}: LiveBroadcastCardBodyProps) {
  const bundle = data.locales[locale];
  const stateCopy = runtime.todayIsExcluded
    ? `${bundle.stateCopy.offline} ${bundle.time.thursdayNote}`
    : bundle.stateCopy[runtime.state];

  return (
    <>
      <section className={styles.card} data-docs-live-state={runtime.state}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{bundle.eyebrow}</p>
          <div className={styles.headerRow}>
            <h2 className={styles.title}>{bundle.title}</h2>
            <span className={styles.statusPill}>{bundle.status[runtime.state]}</span>
          </div>
          <p className={styles.description}>{bundle.description}</p>
          <p className={styles.stateCopy}>{stateCopy}</p>

          <dl className={styles.timeGrid}>
            <div className={styles.timeCard}>
              <dt>{bundle.time.nextLabel}</dt>
              <dd>{runtime.localStartLabel}</dd>
            </div>
            <div className={styles.timeCard}>
              <dt>{bundle.time.localLabel}</dt>
              <dd>{runtime.localStartLabel}</dd>
            </div>
            <div className={styles.timeCard}>
              <dt>{bundle.time.beijingLabel}</dt>
              <dd>{runtime.beijingStartLabel}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.qrPanel}>
          {qrAvailable ? (
            <img
              src={LIVE_BROADCAST_QR_IMAGE_URL}
              alt={data.qrCode.alt[locale]}
              width={data.qrCode.width}
              height={data.qrCode.height}
              loading="lazy"
              className={styles.qrImage}
              onError={onQrError}
            />
          ) : (
            <div className={styles.qrFallback} role="status">
              <span className={styles.qrFallbackIcon} aria-hidden="true">□</span>
              <span>{data.qrCode.fallbackLabel[locale]}</span>
            </div>
          )}
        </div>
      </section>

      <LiveBroadcastReminder
        locale={locale}
        state={runtime.state}
        previewCopy={bundle.reminder.preview}
        liveCopy={bundle.reminder.live}
      />
    </>
  );
}

export default function LiveBroadcastCardClient({ locale, initialData = null }: LiveBroadcastCardClientProps) {
  const [data, setData] = useState<LiveBroadcastData | null>(initialData);
  const [runtime, setRuntime] = useState<LiveBroadcastRuntime | null>(
    initialData ? getLiveBroadcastRuntime(initialData, locale) : null,
  );
  const [qrAvailable, setQrAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const applyData = (nextData: LiveBroadcastData) => {
      setData(nextData);
      setRuntime(getLiveBroadcastRuntime(nextData, locale));
      setQrAvailable(true);

      if (typeof intervalId !== 'undefined') {
        window.clearInterval(intervalId);
      }

      intervalId = window.setInterval(() => {
        setRuntime(getLiveBroadcastRuntime(nextData, locale));
      }, LIVE_BROADCAST_REFRESH_MS);
    };

    if (initialData) {
      applyData(initialData);
    }

    const load = async () => {
      const result = await loadLiveBroadcastData();

      if (cancelled || !result.data) {
        return;
      }

      applyData(result.data);
    };

    load();

    return () => {
      cancelled = true;
      if (typeof intervalId !== 'undefined') {
        window.clearInterval(intervalId);
      }
    };
  }, [initialData, locale]);

  if (!data || !runtime) {
    return null;
  }

  return (
    <LiveBroadcastCardBody
      data={data}
      locale={locale}
      runtime={runtime}
      qrAvailable={qrAvailable}
      onQrError={() => setQrAvailable(false)}
    />
  );
}
