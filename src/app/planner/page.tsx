'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '@/lib/store';

type ViewMode = 'all' | 'tasks' | 'goals';

export default function MapPage() {
  const { tasks, goals, links, linkTaskToGoal, saveNodePosition, nodePositions } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Build nodes from tasks and goals
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];
    let taskCounter = 0;
    let goalCounter = 0;

    if (viewMode === 'all' || viewMode === 'tasks') {
      tasks
        .filter((t) => !t.isArchived)
        .forEach((task) => {
          const savedPos = nodePositions[`task-${task.id}`];
          nodes.push({
            id: `task-${task.id}`,
            type: 'default',
            data: { label: task.title },
            position: savedPos || { x: 100, y: 100 + taskCounter * 100 },
            style: {
              background: '#8b5cf6',
              color: '#fff',
              border: '2px solid #6d28d9',
              borderRadius: '50%',
              width: 120,
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
              padding: '10px',
              textAlign: 'center',
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
          taskCounter++;
        });
    }

    if (viewMode === 'all' || viewMode === 'goals') {
      goals
        .filter((g) => !g.isArchived)
        .forEach((goal) => {
          const savedPos = nodePositions[`goal-${goal.id}`];
          nodes.push({
            id: `goal-${goal.id}`,
            type: 'default',
            data: { label: goal.title },
            position: savedPos || { x: 500, y: 100 + goalCounter * 150 },
            style: {
              background: '#10b981',
              color: '#fff',
              border: '2px solid #059669',
              borderRadius: '8px',
              width: 150,
              height: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
              padding: '12px',
              textAlign: 'center',
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
          goalCounter++;
        });
    }

    return nodes;
  }, [tasks, goals, viewMode, nodePositions]);

  // Build edges from links
  const initialEdges: Edge[] = useMemo(() => {
    return links.map((link) => ({
      id: link.id,
      source: `task-${link.taskId}`,
      target: `goal-${link.goalId}`,
      label: `${link.contributionWeight}%`,
      type: 'default',
      animated: true,
      style: { stroke: '#8b5cf6', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#8b5cf6',
      },
    }));
  }, [links]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when view mode changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Extract task and goal IDs
      const taskId = connection.source.replace('task-', '');
      const goalId = connection.target.replace('goal-', '');

      // Only allow task → goal connections
      if (connection.source.startsWith('task-') && connection.target.startsWith('goal-')) {
        linkTaskToGoal(taskId, goalId, 50); // Default 50% weight
        setEdges((eds) => addEdge(connection, eds));
      }
    },
    [linkTaskToGoal, setEdges]
  );

  // Save node position on drag end
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      saveNodePosition(node.id, node.position);
    },
    [saveNodePosition]
  );

  return (
    <div className="fixed inset-0 bg-slate-950 flex">
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-20 left-4 z-50 p-3 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg transition-all"
      >
        {isSidebarOpen ? '✕' : '☰'}
      </button>

      {/* Side Navigation - Responsive */}
      <div
        className={`
          fixed md:relative
          w-64 h-full bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-4
          transition-transform duration-300 ease-in-out z-40
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <h2 className="text-xl font-bold text-white mb-4">Map View</h2>

        {/* View Mode Toggle */}
        <div className="space-y-2">
          <p className="text-sm text-slate-500 uppercase tracking-wide mb-2">View</p>
          <button
            onClick={() => {
              setViewMode('all');
              setIsSidebarOpen(false);
            }}
            className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
              viewMode === 'all'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🗺️ All (Tasks + Goals)
          </button>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <a 
              href="/goals" 
              className="flex items-center justify-center px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700 hover:border-violet-500"
            >
              Start Goals List
            </a>
            <a 
              href="/tasks" 
              className="flex items-center justify-center px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700 hover:border-violet-500"
            >
              Tasks List
            </a>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <p className="text-sm text-slate-500 uppercase tracking-wide mb-3">Legend</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600 border-2 border-violet-700" />
              <span className="text-sm text-slate-300">Task (Circle)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-6 rounded bg-emerald-600 border-2 border-emerald-700" />
              <span className="text-sm text-slate-300">Goal (Box)</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-4">
            💡 Drag from a task to a goal to create a link
          </p>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* React Flow Canvas */}
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          fitView
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          panOnDrag
          className="bg-slate-950 w-full h-full"
          minZoom={0.1}
          maxZoom={4}
        >
          <Background color="#334155" gap={16} />
          <Controls 
            className="bg-slate-800 border border-slate-700 !bottom-20 md:!bottom-4"
            showInteractive={false}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
