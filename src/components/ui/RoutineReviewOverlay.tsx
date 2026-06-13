'use client';

import { useState, useEffect } from 'react';
import { useTimeSlots } from '@/lib/hooks/useTimeSlots';
import { useTasks } from '@/lib/hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';
import type { TimeSlot, Task } from '@/lib/types';

export function RoutineReviewOverlay() {
  const queryClient = useQueryClient();
  const { data: timeSlots, isLoading: slotsLoading } = useTimeSlots();
  const { data: tasks, isLoading: tasksLoading } = useTasks();

  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [slotTasks, setSlotTasks] = useState<Task[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, 'completed' | 'blocked' | 'skipped'>>({});
  const [taskFeedbacks, setTaskFeedbacks] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);

  useEffect(() => {
    if (slotsLoading || tasksLoading || !timeSlots || !tasks) return;

    const checkRoutineTrigger = () => {
      // 1. Check if snoozed
      if (Date.now() < snoozedUntil) {
        return;
      }

      // 2. Get local time details
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const totalCurrentMinutes = currentHours * 60 + currentMinutes;
      
      const todayStr = now.toISOString().split('T')[0];
      
      // Load reviewed slots for today from localStorage
      const reviewedKey = `reviewed_slots_${todayStr}`;
      const reviewedJson = localStorage.getItem(reviewedKey);
      const reviewedIds: string[] = reviewedJson ? JSON.parse(reviewedJson) : [];

      // 3. Find the most recently ended active slot that hasn't been reviewed today
      let triggerSlot: TimeSlot | null = null;
      let maxEndMinutes = -1;

      const activeSlots = timeSlots.filter(s => s.isActive);

      for (const slot of activeSlots) {
        if (reviewedIds.includes(slot.id)) continue;

        // Parse slot end time (format "HH:MM")
        const [endHourStr, endMinStr] = slot.endTime.split(':');
        const endHour = parseInt(endHourStr, 10);
        const endMin = parseInt(endMinStr, 10);
        const totalEndMinutes = endHour * 60 + endMin;

        // Trigger if: current time is at or past end_time AND within a 3-hour (180 mins) window
        if (totalCurrentMinutes >= totalEndMinutes && (totalCurrentMinutes - totalEndMinutes) < 180) {
          if (totalEndMinutes > maxEndMinutes) {
            maxEndMinutes = totalEndMinutes;
            triggerSlot = slot;
          }
        }
      }

      if (triggerSlot) {
        setActiveSlot(triggerSlot);

        // Find tasks associated with this slot's goals
        let associatedTasks = tasks.filter(t => 
          !t.isArchived && 
          t.goalId && 
          triggerSlot?.goalIds?.includes(t.goalId)
        );

        // Fallback: If no tasks directly linked, show uncompleted daily tasks
        if (associatedTasks.length === 0) {
          associatedTasks = tasks.filter(t => !t.isArchived && !t.isCompleted);
        }

        setSlotTasks(associatedTasks);

        // Initialize statuses and feedbacks
        const initialStatuses: Record<string, 'completed' | 'blocked' | 'skipped'> = {};
        const initialFeedbacks: Record<string, string> = {};
        
        associatedTasks.forEach(t => {
          initialStatuses[t.id] = t.isCompleted ? 'completed' : 'completed';
          initialFeedbacks[t.id] = '';
        });

        setTaskStatuses(initialStatuses);
        setTaskFeedbacks(initialFeedbacks);
      } else {
        setActiveSlot(null);
      }
    };

    // Run every 20 seconds
    checkRoutineTrigger();
    const interval = setInterval(checkRoutineTrigger, 20000);
    return () => clearInterval(interval);
  }, [timeSlots, tasks, slotsLoading, tasksLoading, snoozedUntil]);

  const handleStatusChange = (taskId: string, status: 'completed' | 'blocked' | 'skipped') => {
    setTaskStatuses(prev => ({ ...prev, [taskId]: status }));
  };

  const handleFeedbackChange = (taskId: string, text: string) => {
    setTaskFeedbacks(prev => ({ ...prev, [taskId]: text }));
  };

  const handleSnooze = () => {
    // Snooze for 15 minutes
    setSnoozedUntil(Date.now() + 15 * 60 * 1000);
    setActiveSlot(null);
  };

  const handleSubmit = async () => {
    if (!activeSlot) return;

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const reviews = slotTasks.map(t => ({
        taskId: t.id,
        taskTitle: t.title,
        status: taskStatuses[t.id] || 'completed',
        feedback: taskFeedbacks[t.id] || ''
      }));

      // If general feedback is added, create a dummy general review or append to reviews
      if (generalFeedback.trim()) {
        // Appending general feedback as a meta entry
        reviews.push({
          taskId: activeSlot.id,
          taskTitle: `Routine Check: ${activeSlot.name}`,
          status: 'completed',
          feedback: `General notes: ${generalFeedback}`
        });
      }

      // Submit to our new API route
      const res = await fetch('/api/shortcuts/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviews,
          obsidianPath: `Journal/Reviews-${todayStr}.md` // User customizable later
        })
      });

      if (!res.ok) {
        throw new Error('Failed to submit reviews');
      }

      // Mark as reviewed in localStorage
      const reviewedKey = `reviewed_slots_${todayStr}`;
      const reviewedJson = localStorage.getItem(reviewedKey);
      const reviewedIds: string[] = reviewedJson ? JSON.parse(reviewedJson) : [];
      
      if (!reviewedIds.includes(activeSlot.id)) {
        reviewedIds.push(activeSlot.id);
        localStorage.setItem(reviewedKey, JSON.stringify(reviewedIds));
      }

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['timeslots'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });

      // Reset states
      setActiveSlot(null);
      setGeneralFeedback('');
    } catch (err) {
      console.error('[RoutineReviewOverlay] Submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeSlot || slotTasks.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'rgba(3, 7, 12, 0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'rgba(11, 22, 34, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-hi)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 50px rgba(16, 185, 129, 0.15)',
          borderRadius: '20px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          maxHeight: '90dvh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px #10b981',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-family-display)',
                fontSize: '1.15rem',
                fontWeight: 600,
                color: 'var(--text-bright, #fff)',
                letterSpacing: '0.01em',
              }}
            >
              Time Slot Completed
            </span>
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#10b981',
              margin: 0,
            }}
          >
            {activeSlot.name}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
            Routine ended at {activeSlot.endTime}. Let&apos;s review your progress.
          </p>
        </div>

        {/* Task List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '4px' }}>
          {slotTasks.map(task => (
            <div
              key={task.id}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-bright, #fff)' }}>
                {task.title}
              </span>

              {/* Status Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {(['completed', 'blocked', 'skipped'] as const).map(status => {
                  const isSelected = taskStatuses[task.id] === status;
                  let btnBg = 'rgba(255, 255, 255, 0.04)';
                  let btnBorder = '1px solid rgba(255, 255, 255, 0.08)';
                  let btnColor = 'var(--text-dim, #a0aec0)';
                  
                  if (isSelected) {
                    if (status === 'completed') {
                      btnBg = 'rgba(16, 185, 129, 0.15)';
                      btnBorder = '1px solid #10b981';
                      btnColor = '#10b981';
                    } else if (status === 'blocked') {
                      btnBg = 'rgba(239, 68, 68, 0.15)';
                      btnBorder = '1px solid #ef4444';
                      btnColor = '#ef4444';
                    } else {
                      btnBg = 'rgba(245, 158, 11, 0.15)';
                      btnBorder = '1px solid #f59e0b';
                      btnColor = '#f59e0b';
                    }
                  }

                  return (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(task.id, status)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: btnBg,
                        border: btnBorder,
                        color: btnColor,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {status.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Input */}
              <input
                type="text"
                value={taskFeedbacks[task.id] || ''}
                onChange={(e) => handleFeedbackChange(task.id, e.target.value)}
                placeholder={
                  taskStatuses[task.id] === 'completed'
                    ? 'Wins / notes (optional)'
                    : taskStatuses[task.id] === 'blocked'
                    ? 'What is blocking you?'
                    : 'Reason for skipping'
                }
                style={{
                  width: '100%',
                  height: '36px',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '0 0.75rem',
                  fontSize: '0.85rem',
                  color: '#fff',
                  outline: 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* General Feedback */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            General Notes for this Routine (optional)
          </label>
          <textarea
            value={generalFeedback}
            onChange={(e) => setGeneralFeedback(e.target.value)}
            placeholder="How did this time slot feel? Any distractions or patterns?"
            style={{
              width: '100%',
              minHeight: '60px',
              maxHeight: '100px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              color: '#fff',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button
            onClick={handleSnooze}
            style={{
              flex: 1,
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            Snooze 15m
          </button>
          
          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            style={{
              flex: 2,
              height: '42px',
              borderRadius: '8px',
              backgroundColor: '#10b981',
              border: '1px solid #10b981',
              color: '#061712',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#059669';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = '#10b981';
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
