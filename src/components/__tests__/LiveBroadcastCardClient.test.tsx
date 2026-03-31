import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  LIVE_BROADCAST_PROFILE_URL,
  LIVE_BROADCAST_QR_IMAGE_URL,
  type LiveBroadcastData,
  type LiveBroadcastRuntime,
} from '@/lib/live-broadcast';
import LiveBroadcastCardClient, { LiveBroadcastCardBody } from '../LiveBroadcastCardClient';

const data: LiveBroadcastData = {
  version: '1.0.0',
  updatedAt: '2026-03-31T00:00:00.000Z',
  timezone: {
    iana: 'Asia/Shanghai',
    utcOffsetMinutes: 480,
    label: {
      'zh-CN': '北京时间（UTC+8）',
      en: 'Beijing Time (UTC+8)',
    },
  },
  schedule: {
    activeWeekdays: [0, 1, 2, 3, 5, 6],
    excludedWeekdays: [4],
    previewStartTime: '18:00',
    startTime: '20:00',
    endTime: '21:00',
  },
  qrCode: {
    width: 201,
    height: 213,
    alt: {
      'zh-CN': 'Hagicode 抖音直播二维码',
      en: 'Douyin QR code for the Hagicode live broadcast',
    },
    fallbackLabel: {
      'zh-CN': '二维码暂时不可用',
      en: 'QR image unavailable',
    },
  },
  locales: {
    'zh-CN': {
      eyebrow: '直播预告',
      title: 'Hagicode 每日直播编程间',
      description: '每天 20:00 按北京时间开播，扫码进入抖音直播间。周四固定停播。',
      status: {
        upcoming: '即将开始',
        live: '正在直播',
        offline: '暂未开播',
      },
      stateCopy: {
        upcoming: '今晚 20:00 开播，18:00 起会显示直播提醒。',
        live: 'Hagicode 现场直播正在进行。扫码观看最新系统 AI 实战演示，现场交流。',
        offline: '当前不在直播窗口，页面会自动显示下一场时间。',
      },
      reminder: {
        preview: '直播即将开始',
        live: 'Hagicode 现场直播正在进行。扫码观看最新系统 AI 实战演示，现场交流。',
        cta: '打开二维码',
      },
      time: {
        beijingLabel: '北京时间',
        localLabel: '你的本地时间',
        nextLabel: '下一场',
        thursdayNote: '周四固定停播',
      },
    },
    en: {
      eyebrow: 'Live Broadcast',
      title: 'Daily Hagi Live Coding Room',
      description: 'The recurring Hagi coding stream starts at 20:00 Beijing time. Scan the Douyin QR code to join. Thursday stays offline.',
      status: {
        upcoming: 'Upcoming',
        live: 'Live now',
        offline: 'Offline',
      },
      stateCopy: {
        upcoming: 'The room starts at 20:00 Beijing time and shows a reminder from 18:00.',
        live: 'The stream is live right now. Scan the QR code to join the room.',
        offline: 'The room is outside its active window right now. The next start time stays visible below.',
      },
      reminder: {
        preview: 'Live starts soon',
        live: 'Now live, scan to watch',
        cta: 'Open QR',
      },
      time: {
        beijingLabel: 'Beijing time',
        localLabel: 'Your local time',
        nextLabel: 'Next stream',
        thursdayNote: 'Thursday is the weekly off day',
      },
    },
  },
};

const liveRuntime: LiveBroadcastRuntime = {
  state: 'live',
  reminderVisible: true,
  todayIsExcluded: false,
  sessionStartAt: new Date('2026-03-31T12:00:00.000Z'),
  localStartLabel: 'Tue 5:00 AM',
  beijingStartLabel: 'Tue 8:00 PM',
};

const offlineRuntime: LiveBroadcastRuntime = {
  state: 'offline',
  reminderVisible: false,
  todayIsExcluded: true,
  sessionStartAt: new Date('2026-04-03T12:00:00.000Z'),
  localStartLabel: 'Fri 5:00 AM',
  beijingStartLabel: 'Fri 8:00 PM',
};

describe('LiveBroadcastCardBody markup', () => {
  it('renders the docs live card statically when initial data is present', () => {
    const markup = renderToStaticMarkup(<LiveBroadcastCardClient locale="en" initialData={data} />);

    expect(markup).toContain('Daily Hagi Live Coding Room');
    expect(markup).not.toContain('Open QR');
    expect(markup.split(LIVE_BROADCAST_QR_IMAGE_URL)).toHaveLength(4);
    expect(markup).toContain(LIVE_BROADCAST_PROFILE_URL);
  });

  it('degrades to a QR placeholder without dropping the live card', () => {
    const markup = renderToStaticMarkup(
      <LiveBroadcastCardBody
        data={data}
        locale="en"
        runtime={liveRuntime}
        qrAvailable={false}
      />,
    );

    expect(markup).toContain('Daily Hagi Live Coding Room');
    expect(markup.split('QR image unavailable')).toHaveLength(3);
    expect(markup).not.toContain('Open QR');
    expect(markup).toContain('data-docs-live-reminder="live"');
  });

  it('keeps Thursday offline without an active reminder node', () => {
    const markup = renderToStaticMarkup(
      <LiveBroadcastCardBody
        data={data}
        locale="en"
        runtime={offlineRuntime}
        qrAvailable={true}
      />,
    );

    expect(markup).toContain('Thursday is the weekly off day');
    expect(markup).not.toContain('data-docs-live-reminder=');
  });

  it('avoids importing site-owned implementation code', async () => {
    const { readFile } = await import('node:fs/promises');
    const [cardSource, reminderSource] = await Promise.all([
      readFile(new URL('../LiveBroadcastCardClient.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../LiveBroadcastReminder.tsx', import.meta.url), 'utf8'),
    ]);

    const combined = `${cardSource}
${reminderSource}`;
    expect(combined).not.toContain('repos/site');
    expect(combined).not.toContain('@/components/home');
  });
});
