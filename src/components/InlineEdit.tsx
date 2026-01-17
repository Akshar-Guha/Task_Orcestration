'use client';

import { useState, useRef, useEffect } from 'react';

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}

export function InlineEdit({ 
  value, 
  onSave, 
  className = '', 
  placeholder = 'Click to edit...',
  multiline = false,
  disabled = false
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue.trim() === '') {
      setEditValue(value); // Reset if empty
      setIsEditing(false);
      return;
    }

    if (editValue !== value) {
      setIsSaving(true);
      await onSave(editValue);
      setIsSaving(false);
    }
    
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (disabled) {
    return <span className={className}>{value}</span>;
  }

  if (isEditing) {
    const baseInputClass = `
      w-full px-2 py-1 bg-slate-700 border-2 border-violet-500 rounded
      text-white placeholder-slate-500
      focus:outline-none focus:ring-2 focus:ring-violet-500/50
      transition-all
      ${className}
    `;

    return multiline ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${baseInputClass} resize-none min-h-[60px]`}
        rows={3}
        style={{ fontSize: '16px' }} // Prevent iOS zoom
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={baseInputClass}
        style={{ fontSize: '16px' }} // Prevent iOS zoom
      />
    );
  }

  return (
    <div
      onClick={() => !disabled && setIsEditing(true)}
      className={`
        cursor-pointer group relative
        ${isSaving ? 'opacity-50 pointer-events-none' : ''}
        ${className}
      `}
    >
      <span className="group-hover:text-violet-400 transition-colors">
        {value || placeholder}
      </span>
      {isSaving && (
        <span className="ml-2 text-xs text-slate-500 animate-pulse">Saving...</span>
      )}
      {!isSaving && (
        <span className="ml-2 text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
          ✏️
        </span>
      )}
    </div>
  );
}
