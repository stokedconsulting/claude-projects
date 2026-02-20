interface TopBarProps {
  currentView: string;
}

const VIEW_LABELS: Record<string, string> = {
  overview: 'Workspace Overview',
  'project-list': 'Projects',
  history: 'Task History',
  settings: 'Settings',
};

export function TopBar({ currentView }: TopBarProps) {
  return (
    <div className="h-14 border-b border-github-border bg-github-card px-6 flex items-center">
      <span className="text-github-text font-semibold text-sm">
        {VIEW_LABELS[currentView] ?? 'TopBar'}
      </span>
    </div>
  );
}
