'use client';

import { useState, useEffect } from 'react';
import { setupPushNotifications } from '@/lib/push';

function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}
function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone ||
    window.matchMedia('(display-mode: standalone)').matches;
}

type NotificationType = 'task' | 'habit' | 'goal' | 'sleep_wake' | 'custom';

interface NotificationRule {
  id: string;
  title: string;
  body: string;
  notification_type: NotificationType;
  linked_entity_id?: string;
  linked_entity_name?: string;
  schedule_time?: string;
  repeat_days?: number[];
  is_enabled: boolean;
  snooze_interval_minutes?: number;
  created_at: string;
}

interface Entity { id: string; name: string; }

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const SNOOZE_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
];

const TYPE_LABELS: Record<NotificationType, string> = {
  task: 'Task',
  habit: 'Habit',
  goal: 'Goal',
  sleep_wake: 'Sleep / Wake',
  custom: 'Custom',
};

function typePreview(type: NotificationType, entityName?: string): { title: string; body: string } {
  switch (type) {
    case 'task':
      return { title: 'Task Check', body: `Did you complete: ${entityName || '…'}?` };
    case 'habit':
      return { title: 'Habit Check', body: `Did you complete: ${entityName || '…'}?` };
    case 'goal':
      return { title: 'Goal Review', body: `Take a moment to review: ${entityName || '…'}` };
    case 'sleep_wake':
      return { title: 'Sleep Tracker', body: 'Time to log your sleep / wake time!' };
    default:
      return { title: '', body: '' };
  }
}

const EMPTY_FORM = {
  notification_type: 'habit' as NotificationType,
  linked_entity_id: '',
  schedule_time: '08:00',
  repeat_days: [1, 2, 3, 4, 5] as number[],
  snooze_interval_minutes: 15,
  custom_title: '',
  custom_body: '',
};

export default function NotificationsPage() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [savingRule, setSavingRule] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Entity[]>([]);
  const [habits, setHabits] = useState<Entity[]>([]);
  const [goals, setGoals] = useState<Entity[]>([]);

  const iosDevice = isIOS();
  const standaloneMode = isStandalone();

  useEffect(() => {
    navigator.serviceWorker?.getRegistration().then(reg => {
      if (reg) setIsSubscribed(true);
    });
  }, []);

  useEffect(() => {
    loadRules();
    loadEntities();
  }, []);

  async function loadRules() {
    setRulesLoading(true);
    const res = await fetch('/api/notifications/rules');
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules || []);
    }
    setRulesLoading(false);
  }

  async function loadEntities() {
    const [tasksRes, habitsRes, goalsRes] = await Promise.all([
      fetch('/api/tasks').catch(() => null),
      fetch('/api/habits').catch(() => null),
      fetch('/api/goals').catch(() => null),
    ]);
    if (tasksRes?.ok) {
      const d = await tasksRes.json();
      setTasks((d.tasks || []).filter((t: any) => !t.is_archived && !t.is_completed).map((t: any) => ({ id: t.id, name: t.title })));
    }
    if (habitsRes?.ok) {
      const d = await habitsRes.json();
      setHabits((d.habits || []).map((h: any) => ({ id: h.id, name: h.title || h.name })));
    }
    if (goalsRes?.ok) {
      const d = await goalsRes.json();
      setGoals((d.goals || []).map((g: any) => ({ id: g.id, name: g.title || g.name })));
    }
  }

  async function handleSubscribe() {
    setLoading(true);
    setMessage('');
    try {
      const result = await setupPushNotifications();
      if (result.success) {
        setIsSubscribed(true);
        setPermission('granted');
        setMessage('Notifications enabled on this iPhone.');
      } else {
        setMessage(result.error || 'Failed to enable notifications.');
      }
    } catch (e: any) {
      setMessage(e.message || 'Error enabling notifications.');
    }
    setLoading(false);
  }

  function entityListForType(type: NotificationType): Entity[] {
    if (type === 'task') return tasks;
    if (type === 'habit') return habits;
    if (type === 'goal') return goals;
    return [];
  }

  function selectedEntityName(): string {
    if (!form.linked_entity_id) return '';
    return entityListForType(form.notification_type).find(e => e.id === form.linked_entity_id)?.name || '';
  }

  async function handleSaveRule() {
    setFormError('');
    const needsEntity = ['task', 'habit', 'goal'].includes(form.notification_type);
    if (needsEntity && !form.linked_entity_id) {
      setFormError(`Pick a ${TYPE_LABELS[form.notification_type]}.`);
      return;
    }
    if (form.notification_type === 'custom' && (!form.custom_title.trim() || !form.custom_body.trim())) {
      setFormError('Title and message are required for custom notifications.');
      return;
    }
    if (!form.schedule_time) {
      setFormError('Schedule time is required.');
      return;
    }

    const entityName = form.notification_type === 'custom' ? '' : selectedEntityName();
    const { title, body } = form.notification_type === 'custom'
      ? { title: form.custom_title.trim(), body: form.custom_body.trim() }
      : typePreview(form.notification_type, entityName);

    setSavingRule(true);
    const res = await fetch('/api/notifications/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        notification_type: form.notification_type,
        linked_entity_id: form.linked_entity_id || null,
        linked_entity_name: entityName || null,
        schedule_time: form.schedule_time,
        repeat_days: form.repeat_days.length ? form.repeat_days : null,
        snooze_interval_minutes: form.snooze_interval_minutes,
        requires_acknowledgment: true,
        is_manual: false,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      loadRules();
    } else {
      const d = await res.json();
      setFormError(d.error || 'Failed to save.');
    }
    setSavingRule(false);
  }

  async function handleToggle(id: string, enabled: boolean) {
    await fetch(`/api/notifications/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: enabled }),
    });
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_enabled: enabled } : r));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/notifications/rules/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
  }

  async function handleSendNow(id: string) {
    setSendingId(id);
    const res = await fetch(`/api/notifications/rules/${id}`, { method: 'POST' });
    const d = await res.json();
    setMessage(res.ok ? 'Notification sent!' : (d.error || 'Send failed.'));
    setSendingId(null);
    setTimeout(() => setMessage(''), 3000);
  }

  const needsEntityPicker = ['task', 'habit', 'goal'].includes(form.notification_type);
  const entityList = entityListForType(form.notification_type);
  const previewEntityName = selectedEntityName();
  const preview = form.notification_type !== 'custom'
    ? typePreview(form.notification_type, previewEntityName || '[entity]')
    : null;

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)', fontFamily: 'var(--font-family-body)' }}>
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>Notifications</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Alarm-style reminders tied to your habits, tasks, and goals. Re-fires every N minutes until you tap Done.
        </p>

        {iosDevice && !standaloneMode && (
          <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Add to Home Screen first</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              iOS push requires the app installed as PWA. Share → "Add to Home Screen".
            </p>
          </div>
        )}

        {iosDevice && standaloneMode && permission !== 'granted' && (
          <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'Enabling…' : 'Enable on this iPhone'}
            </button>
          </div>
        )}

        {message && (
          <div className="rounded-lg px-4 py-2 mb-4 text-sm" style={{ background: 'var(--card)', color: 'var(--text)' }}>
            {message}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Reminders</span>
          <button
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="text-sm px-3 py-1 rounded-lg font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            + Add
          </button>
        </div>

        {rulesLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No reminders yet.</p>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSendNow={handleSendNow}
                sendingId={sendingId}
              />
            ))}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-xl rounded-t-2xl flex flex-col" style={{ background: 'var(--bg)', maxHeight: '90dvh' }}>
              {/* Header — never scrolls away */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>New Reminder</h2>
                <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>✕</button>
              </div>

              {/* Scrollable form body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Type</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(Object.keys(TYPE_LABELS) as NotificationType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, notification_type: t, linked_entity_id: '' }))}
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{
                        background: form.notification_type === t ? 'var(--accent)' : 'transparent',
                        color: form.notification_type === t ? '#fff' : 'var(--text)',
                        borderColor: form.notification_type === t ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                {needsEntityPicker && (
                  <>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Which {TYPE_LABELS[form.notification_type].toLowerCase()}?
                    </label>
                    {entityList.length === 0 ? (
                      <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                        No active {TYPE_LABELS[form.notification_type].toLowerCase()}s found.
                      </p>
                    ) : (
                      <select
                        value={form.linked_entity_id}
                        onChange={e => setForm(f => ({ ...f, linked_entity_id: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm mb-4"
                        style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      >
                        <option value="">Select…</option>
                        {entityList.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}

                {form.notification_type === 'custom' && (
                  <>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                    <input
                      value={form.custom_title}
                      onChange={e => setForm(f => ({ ...f, custom_title: e.target.value }))}
                      placeholder="e.g. Drink water"
                      className="w-full rounded-lg px-3 py-2 text-sm mb-3"
                      style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    />
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Message</label>
                    <input
                      value={form.custom_body}
                      onChange={e => setForm(f => ({ ...f, custom_body: e.target.value }))}
                      placeholder="e.g. Have you drunk 2L today?"
                      className="w-full rounded-lg px-3 py-2 text-sm mb-4"
                      style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    />
                  </>
                )}

                {preview && (form.linked_entity_id || form.notification_type === 'sleep_wake') && (
                  <div className="rounded-lg px-4 py-3 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>Preview</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{preview.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{preview.body}</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Buttons: {['task','habit','custom'].includes(form.notification_type) ? '[✅ Done]  [⏰ Later]' : '[📱 Open App]  [⏰ Later]'}
                    </p>
                  </div>
                )}

                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fire at</label>
                <input
                  type="time"
                  value={form.schedule_time}
                  onChange={e => setForm(f => ({ ...f, schedule_time: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm mb-4"
                  style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />

                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Repeat on</label>
                <div className="flex gap-1 mb-4">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setForm(f => ({
                        ...f,
                        repeat_days: f.repeat_days.includes(i)
                          ? f.repeat_days.filter(x => x !== i)
                          : [...f.repeat_days, i].sort(),
                      }))}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: form.repeat_days.includes(i) ? 'var(--accent)' : 'var(--card)',
                        color: form.repeat_days.includes(i) ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Re-fire every (if not tapped Done)</label>
                <div className="flex gap-2 flex-wrap">
                  {SNOOZE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setForm(f => ({ ...f, snooze_interval_minutes: o.value }))}
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{
                        background: form.snooze_interval_minutes === o.value ? 'var(--accent)' : 'transparent',
                        color: form.snooze_interval_minutes === o.value ? '#fff' : 'var(--text)',
                        borderColor: form.snooze_interval_minutes === o.value ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      {o.value} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Save button — always visible at bottom */}
              <div className="px-6 pt-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
                {formError && (
                  <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{formError}</p>
                )}
                <button
                  onClick={handleSaveRule}
                  disabled={savingRule}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {savingRule ? 'Saving…' : 'Save Reminder'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RuleCard({
  rule, onToggle, onDelete, onSendNow, sendingId,
}: {
  rule: NotificationRule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onSendNow: (id: string) => void;
  sendingId: string | null;
}) {
  const typeLabel = TYPE_LABELS[rule.notification_type] || rule.notification_type;
  const snooze = rule.snooze_interval_minutes;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: rule.is_enabled ? 1 : 0.5 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#eff6ff', color: 'var(--accent)' }}>
              {typeLabel}
            </span>
            {rule.linked_entity_name && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rule.linked_entity_name}</span>
            )}
          </div>
          <p className="text-sm font-medium truncate mt-0.5" style={{ color: 'var(--text)' }}>{rule.title}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{rule.body}</p>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {rule.schedule_time && <span>⏰ {rule.schedule_time}</span>}
            {snooze && <span>↺ {snooze}m</span>}
            <span>
              {rule.repeat_days?.length
                ? rule.repeat_days.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')
                : 'Every day'}
            </span>
          </div>
        </div>
        <button
          onClick={() => onToggle(rule.id, !rule.is_enabled)}
          className="w-10 h-6 rounded-full flex-shrink-0 relative mt-0.5"
          style={{ background: rule.is_enabled ? 'var(--accent)' : 'var(--border)' }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: rule.is_enabled ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSendNow(rule.id)}
          disabled={sendingId === rule.id}
          className="text-xs px-3 py-1 rounded-lg"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {sendingId === rule.id ? 'Sending…' : 'Test now'}
        </button>
        <button
          onClick={() => onDelete(rule.id)}
          className="text-xs px-3 py-1 rounded-lg"
          style={{ background: 'var(--bg)', border: '1px solid #ef4444', color: '#ef4444' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
