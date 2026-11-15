export function openFloodWorkspace() {
  if (window.frameElement?.id === 'original-view') {
    window.parent.location.hash = 'flood';
  } else {
    window.open(new URL('../?tab=flood', document.baseURI).href, '_blank', 'noopener');
  }
}
