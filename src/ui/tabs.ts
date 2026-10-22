// Accessible tabs, following the WAI-ARIA "tabs" pattern:
// - the arrow keys (and Home/End) move between tabs and show the matching panel,
// - only the selected tab is in the Tab-key order, so Tab jumps straight into the panel,
// - screen readers hear "tab, selected, 1 of 2".
// Markup: a [role=tablist] with [role=tab] buttons whose aria-controls names their [role=tabpanel].

export function initTabs(tablist: HTMLElement, onSelect?: (panelId: string) => void): void {
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

  function select(tab: HTMLButtonElement, moveFocus: boolean): void {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')!)!.hidden = !selected;
    }
    if (moveFocus) tab.focus();
    onSelect?.(tab.getAttribute('aria-controls')!);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      const targets: Record<string, HTMLButtonElement> = {
        ArrowRight: tabs[index === last ? 0 : index + 1],
        ArrowLeft: tabs[index === 0 ? last : index - 1],
        Home: tabs[0],
        End: tabs[last],
      };
      const target = targets[event.key];
      if (target === undefined) return;
      event.preventDefault();
      select(target, true);
    });
  });
}
