'use client';
import { useState, useCallback } from 'react';
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';
import { transitionTask } from '../lib/api';

const COLUMNS = [
  { id: 'TODO', label: 'To Do', color: '#6b6b85' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: '#7c6af7' },
  { id: 'IN_REVIEW', label: 'In Review', color: '#f7a26a' },
  { id: 'DONE', label: 'Done', color: '#4af7a2' },
  { id: 'BLOCKED', label: 'Blocked', color: '#f76a7c' },
];

const VALID_TRANSITIONS = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  DONE: [],
  BLOCKED: ['TODO', 'IN_PROGRESS'],
};

function Column({ id, label, color, tasks, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px', padding: '0 2px',
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
          {label}
        </span>
        <span style={{
          marginLeft: 'auto',
          background: 'var(--surface2)',
          color: 'var(--text-muted)',
          borderRadius: '10px',
          padding: '1px 8px',
          fontSize: '11px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: '120px',
          background: isOver ? `${color}08` : 'transparent',
          borderRadius: '10px',
          border: isOver ? `1px dashed ${color}40` : '1px dashed transparent',
          transition: 'all 0.15s',
          padding: '2px',
        }}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div style={{
            height: '80px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)', fontSize: '11px',
          }}>
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks, onTaskClick, onRefresh }) {
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }));

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id);
    return acc;
  }, {});

  const handleDragStart = ({ active }) => {
    setActiveTask(tasks.find(t => t.id === active.id));
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    // Determine target column
    let targetStatus = over.id;
    // If dropped on a task, get that task's column
    const overTask = tasks.find(t => t.id === over.id);
    if (overTask) targetStatus = overTask.status;

    if (targetStatus === task.status) return;

    // Validate transition
    if (!VALID_TRANSITIONS[task.status]?.includes(targetStatus)) {
      alert(`Cannot move task from ${task.status} to ${targetStatus}`);
      return;
    }

    try {
      await transitionTask(task.id, targetStatus);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not move task');
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        overflowX: 'auto',
        paddingBottom: '16px',
      }}>
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            tasks={tasksByStatus[col.id] || []}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div style={{ opacity: 0.9, transform: 'rotate(2deg)' }}>
            <TaskCard task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
