const buttons = [...document.querySelectorAll('[data-view]')];
const frames = {
  original: document.querySelector('#original-view'),
  engineering: document.querySelector('#engineering-view'),
};

function show(view) {
  const flood = location.hash === '#flood';
  document.body.dataset.workspace = view;
  for (const [name, frame] of Object.entries(frames)) {
    frame.hidden = name !== view;
    if (name === view && frame.dataset.source && !frame.hasAttribute('src')) {
      frame.src = name === 'engineering' && flood ? frame.dataset.source + '?tab=flood' : frame.dataset.source;
    } else if (name === 'engineering' && view === name && flood) {
      frame.contentWindow?.postMessage({ type: 'hhudam:show-flood' }, location.origin);
    }
  }
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  document.querySelector('details').open = false;
}
function currentView() {
  return ['#engineering', '#flood'].includes(location.hash) ? 'engineering' : 'original';
}
for (const button of buttons) {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    history.replaceState(null, '', view === 'engineering' ? '#engineering' : location.pathname + location.search);
    show(view);
  });
}
frames.engineering.addEventListener('load', () => {
  if (location.hash === '#flood' && !frames.engineering.src.endsWith('?tab=flood')) {
    frames.engineering.contentWindow?.postMessage({ type: 'hhudam:show-flood' }, location.origin);
  }
});
window.addEventListener('hashchange', () => show(currentView()));
show(currentView());
