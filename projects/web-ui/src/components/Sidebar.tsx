interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  currentView: string;
  setCurrentView: (v: string) => void;
}

export function Sidebar({ collapsed, setCollapsed, currentView, setCurrentView }: SidebarProps) {
  return (
    <div
      className={`${collapsed ? 'w-16' : 'w-64'} bg-github-card border-r border-github-border h-full flex flex-col transition-all duration-200`}
    >
      <div className="p-4 flex items-center justify-between">
        {!collapsed && (
          <span className="text-github-text font-semibold text-sm">Stoked Projects</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-github-text-muted hover:text-github-text p-1 rounded"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'project-list', label: 'Projects' },
          { id: 'history', label: 'History' },
          { id: 'settings', label: 'Settings' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              currentView === item.id
                ? 'bg-accent-blue text-white'
                : 'text-github-text-muted hover:text-github-text hover:bg-github-border'
            }`}
          >
            {collapsed ? item.label[0] : item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
