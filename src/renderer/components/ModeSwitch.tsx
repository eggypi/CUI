interface ModeSwitchProps {
  mode: 'plan' | 'acceptEdits'
  onChange: (mode: 'plan' | 'acceptEdits') => void
}

export default function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="flex items-center gap-1 bg-dark-bg rounded-lg p-0.5">
      <button
        onClick={() => onChange('plan')}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          mode === 'plan'
            ? 'bg-dark-accent text-white'
            : 'text-dark-muted hover:text-dark-text'
        }`}
      >
        Plan
      </button>
      <button
        onClick={() => onChange('acceptEdits')}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          mode === 'acceptEdits'
            ? 'bg-dark-success text-white'
            : 'text-dark-muted hover:text-dark-text'
        }`}
      >
        Accept
      </button>
    </div>
  )
}
