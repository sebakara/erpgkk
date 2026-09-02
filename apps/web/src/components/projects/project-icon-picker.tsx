'use client';
import { cn } from '@/lib/utils';

export const PROJECT_ICONS = [
  '📁', '🚀', '📱', '🏗️', '📊', '⚙️', '🌐', '🛠️',
  '💡', '📦', '🎯', '🧪', '💬', '📝', '🚗', '🏥',
  '🎨', '🔒',
];

export function ProjectIconPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (icon: string) => void;
}) {
  const selected = value || '📁';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
      <div className="flex flex-wrap gap-1">
        {PROJECT_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            className={cn(
              'w-9 h-9 rounded-lg text-lg leading-none flex items-center justify-center border transition-colors',
              selected === icon
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
            )}
            aria-label={`Use ${icon} as project icon`}
            aria-pressed={selected === icon}
          >
            {icon}
          </button>
        ))}
      </div>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste an emoji"
        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
    </div>
  );
}
