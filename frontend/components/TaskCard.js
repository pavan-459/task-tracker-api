'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRIORITY_CONFIG = {
  HIGH: { color: '#f76a7c', bg: 'rgba(247,106,124,0.1)', label: 'HIGH' },
  MEDIUM: { color: '#f7a26a', bg: 'rgba(247,162,106,0.1)', label: 'MED' },
  LOW: { color: '#6b6b85', bg: 'rgba(107,107,133,0.1)', label: 'LOW' },
};

export default function TaskCard({ task, onClick, isDragging: externalDragging }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.LOW;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick && onClick(task)}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '14px',
        marginBottom: '8px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--border2)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Priority + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 6px',
            background: priority.bg,
            color: priority.color,
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            flexShrink: 0,
            marginTop: '2px',
          }}>
            {priority.label}
          </span>
          <span style={{
            fontSize: '13px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
          }}>
            {task.title}
          </span>
        </div>

        {task.description && (
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            marginBottom: '10px',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {task.projectName && (
            <span style={{
              padding: '2px 8px',
              background: 'var(--accent-glow)',
              color: 'var(--accent)',
              borderRadius: '4px',
              fontSize: '10px',
            }}>
              {task.projectName}
            </span>
          )}
          {task.assigneeName && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              color: 'var(--text-muted)', fontSize: '10px',
            }}>
              <span style={{
                width: '16px', height: '16px',
                background: 'var(--border2)',
                borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', color: 'var(--text)',
                flexShrink: 0,
              }}>
                {task.assigneeName[0]}
              </span>
              {task.assigneeName.split(' ')[0]}
            </span>
          )}
          {task.dueDate && (
            <span style={{
              marginLeft: 'auto',
              color: isOverdue ? 'var(--red)' : 'var(--text-dim)',
              fontSize: '10px',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              {isOverdue && '⚠ '}{formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
