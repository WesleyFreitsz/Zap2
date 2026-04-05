import React from 'react';

export default function ContactTagBadge({ tagId, allTags }) {
  const tag = allTags.find(t => t.id === tagId);
  if (!tag) return null;

  const categoryColors = {
    hot:    'bg-red-100 text-red-700 border-red-200',
    warm:   'bg-amber-100 text-amber-700 border-amber-200',
    cold:   'bg-blue-100 text-blue-700 border-blue-200',
    custom: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0 rounded border ${categoryColors[tag.category || 'custom']}`}>
      {tag.name}
    </span>
  );
}