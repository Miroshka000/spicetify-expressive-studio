// Descriptors avoid coupling the adapter to Spotify's temporary class hashes.
export function panelRole({ id = '', legacy = '', gridArea = '', containerName = '', hasPlayer = false }) {
  if (id === 'Desktop_LeftSidebar_Id' || legacy === 'left-sidebar') return 'left-sidebar';
  if (id === 'main-view' || legacy === 'main-view') return 'main-view';
  const axes = gridArea.split('/').map(axis => axis.trim());
  const singleArea = axes.every(axis => axis === axes[0]);
  if (singleArea && axes[0] === 'right-sidebar') return 'right-sidebar';
  if (singleArea && axes[0] === 'now-playing-bar' && hasPlayer) return 'now-playing-bar';
  if (axes[0] === 'main-view' && containerName.split(' ').includes('main-view-grid-area')) return 'main-view';
  // In particular, never paint the cinema overlay or library spacer.
  return '';
}
