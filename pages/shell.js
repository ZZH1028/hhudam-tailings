const buttons = [...document.querySelectorAll('[data-view]')];
const frames = {
  original: document.querySelector('#original-view'),
  engineering: document.querySelector('#engineering-view'),
};

function show(view) {
  document.body.dataset.workspace = view;
  for (const [name, frame] of Object.entries(frames)) {
    frame.hidden = name !== view;
    if (name === view && frame.dataset.source && !frame.hasAttribute('src')) {
      frame.src = frame.dataset.source;
    }
  }
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  document.querySelector('details').open = false;
}
function currentView() {
  return location.hash === '#engineering' ? 'engineering' : 'original';
}
for (const button of buttons) {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    history.replaceState(null, '', view === 'engineering' ? '#engineering' : location.pathname + location.search);
    show(view);
  });
}
window.addEventListener('hashchange', () => show(currentView()));
show(currentView());
