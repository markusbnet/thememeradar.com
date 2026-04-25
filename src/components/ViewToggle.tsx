'use client';

type View = 'cards' | 'table';

interface ViewToggleProps {
  view: View;
  onChange: (view: View) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      className="flex rounded-md border border-gray-300 overflow-hidden"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        aria-pressed={view === 'cards'}
        onClick={() => onChange('cards')}
        className={`px-3 py-2 min-h-[44px] text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${
          view === 'cards'
            ? 'bg-purple-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        Cards
      </button>
      <button
        type="button"
        aria-pressed={view === 'table'}
        onClick={() => onChange('table')}
        className={`px-3 py-2 min-h-[44px] text-sm font-medium border-l border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset ${
          view === 'table'
            ? 'bg-purple-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        Table
      </button>
    </div>
  );
}
