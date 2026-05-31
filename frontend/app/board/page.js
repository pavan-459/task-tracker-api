'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import KanbanBoard from '../../components/KanbanBoard';
import TaskModal from '../../components/TaskModal';
import { getTasks, deleteTask, transitionTask } from '../../lib/api';

const STATUS_COLORS = {
  TODO: '#6b6b85', IN_PROGRESS: '#7c6af7',
  IN_REVIEW: '#f7a26a', DONE: '#4af7a2', BLOCKED: '#f76a7c',
};

export default function BoardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [filters, setFilters] = useState({ status: '', priority: '' });

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      const { tasks } = await getTasks(params);
      setTasks(tasks);
    } catch {}
    finally { setLoading(false); }
  }, [user, filters]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleTaskClick = (task) => setDetailTask(task);

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar onCreateTask={() => setShowCreate(true)} />

      <main style={{ padding: '28px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '22px', marginBottom: '2px' }}>
              Task Board
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              {user.role === 'MEMBER' ? ' assigned to you' : ' in your organization'}
            </p>
          </div>

          {/* Filters */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {['', 'LOW', 'MEDIUM', 'HIGH'].map(p => (
              <button key={p} onClick={() => setFilters(f => ({ ...f, priority: p }))} style={{
                padding: '6px 12px',
                background: filters.priority === p ? 'var(--accent-glow)' : 'var(--surface)',
                border: `1px solid ${filters.priority === p ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '6px',
                color: filters.priority === p ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                transition: 'all 0.15s',
              }}>
                {p || 'All Priority'}
              </button>
            ))}
          </div>
        </div>

        {/* Board */}
        {loading ? (
          <div style={{ display: 'flex', gap: '20px' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ width: '240px', minWidth: '240px' }}>
                <div className="skeleton" style={{ height: '20px', marginBottom: '12px', width: '80px' }} />
                {[1,2].map(j => (
                  <div key={j} className="skeleton" style={{ height: '90px', marginBottom: '8px', borderRadius: '10px' }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <KanbanBoard tasks={tasks} onTaskClick={handleTaskClick} onRefresh={loadTasks} />
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <TaskModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadTasks(); }} />
      )}

      {/* Edit modal */}
      {editTask && (
        <TaskModal task={editTask} onClose={() => setEditTask(null)} onSaved={() => { setEditTask(null); loadTasks(); }} />
      )}

      {/* Detail panel */}
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          user={user}
          onClose={() => setDetailTask(null)}
          onEdit={(t) => { setDetailTask(null); setEditTask(t); }}
          onDelete={async (id) => {
            if (!confirm('Delete this task?')) return;
            await deleteTask(id);
            setDetailTask(null);
            loadTasks();
          }}
          onTransition={async (id, status) => {
            await transitionTask(id, status);
            setDetailTask(null);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}

const TRANSITIONS = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  DONE: [],
  BLOCKED: ['TODO', 'IN_PROGRESS'],
};

function TaskDetailPanel({ task, user, onClose, onEdit, onDelete, onTransition }) {
  const canEdit = user.role !== 'MEMBER';
  const canTransition = task.assigneeId === user.id || user.role !== 'MEMBER';
  const nextStatuses = TRANSITIONS[task.status] || [];

  const statusColor = STATUS_COLORS[task.status];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(12,12,15,0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '24px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%', maxWidth: '500px',
        padding: '28px',
        animation: 'fadeUp 0.25s ease',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{
            padding: '4px 10px',
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}40`,
            color: statusColor,
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            {task.status.replace('_', ' ')}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', marginBottom: '12px', lineHeight: 1.3 }}>
          {task.title}
        </h2>

        {task.description && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
            {task.description}
          </p>
        )}

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {[
            ['Project', task.projectName],
            ['Assignee', task.assigneeName || 'Unassigned'],
            ['Priority', task.priority],
            ['Due', task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '13px', color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Status transitions */}
        {canTransition && nextStatuses.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Move to
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {nextStatuses.map(s => {
                const c = STATUS_COLORS[s];
                return (
                  <button key={s} onClick={() => onTransition(task.id, s)} style={{
                    padding: '7px 14px',
                    background: `${c}12`,
                    border: `1px solid ${c}40`,
                    borderRadius: '7px',
                    color: c,
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: 'DM Mono, monospace',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = `${c}22`}
                    onMouseLeave={e => e.currentTarget.style.background = `${c}12`}
                  >
                    → {s.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => onEdit(task)} style={{
              flex: 1, padding: '10px',
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent)',
              borderRadius: '8px',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '13px',
            }}>
              Edit
            </button>
            <button onClick={() => onDelete(task.id)} style={{
              padding: '10px 16px',
              background: 'var(--red-glow)',
              border: '1px solid var(--red)',
              borderRadius: '8px',
              color: 'var(--red)',
              cursor: 'pointer',
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
            }}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  TODO: '#6b6b85', IN_PROGRESS: '#7c6af7',
  IN_REVIEW: '#f7a26a', DONE: '#4af7a2', BLOCKED: '#f76a7c',
};
