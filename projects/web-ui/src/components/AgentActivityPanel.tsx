interface AgentActivityPanelProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export function AgentActivityPanel({ isOpen, setIsOpen }: AgentActivityPanelProps) {
  return (
    <div className="border-t border-github-border bg-github-card">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-github-text-muted text-xs font-semibold uppercase tracking-wider">
          Agent Activity
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-github-text-muted hover:text-github-text text-xs"
        >
          {isOpen ? '▼ Collapse' : '▲ Expand'}
        </button>
      </div>
      {isOpen && (
        <div className="px-4 pb-4">
          <p className="text-github-text-muted text-sm">No active agent sessions.</p>
        </div>
      )}
    </div>
  );
}
