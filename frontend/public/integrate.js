(() => {
  const app = document.getElementById('app');
  if (!app) return;

  function openWorkspace(reader) {
    if (document.getElementById('tailings-engineering')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'tailings-engineering';
    dialog.setAttribute('aria-label', '工程分析工作台');
    Object.assign(dialog.style, {
      inset: '0', margin: 'auto', padding: '0', width: 'min(1550px, 96vw)', height: '94vh',
      maxWidth: 'none', maxHeight: 'none', border: '1px solid #4280a2',
      borderRadius: '12px', background: '#091825', color: '#e4f2ff',
    });

    const header = document.createElement('header');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      height: '43px', padding: '0 12px', background: '#0d273b',
    });
    const title = document.createElement('strong');
    title.textContent = '尾矿库安全管理平台 · 工程分析';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '返回原工作区 ×';
    Object.assign(close.style, {
      padding: '5px 10px', border: '1px solid #5c93ad', borderRadius: '5px',
      background: '#173b52', color: '#e4f2ff', cursor: 'pointer',
    });
    close.onclick = () => dialog.close();
    header.append(title, close);

    const frame = document.createElement('iframe');
    frame.title = '三维模型、溃坝淹没与专业资料';
    frame.src = '/engineering/' + (reader ? '?view=reader' : '');
    Object.assign(frame.style, { display: 'block', width: '100%', height: 'calc(100% - 43px)', border: '0' });

    dialog.append(header, frame);
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  function addAdminButton(menu) {
    if (!menu || menu.querySelector('[data-engineering-entry]')) return;
    const sample = menu.querySelector('.menu-item');
    if (!sample) return;
    const button = sample.cloneNode(true);
    button.type = 'button';
    button.classList.remove('active');
    button.dataset.engineeringEntry = '';
    button.children[0].textContent = '🧭';
    button.children[1].textContent = '工程分析';
    button.onclick = () => openWorkspace(false);
    menu.append(button);
  }

  function addDashboardButton(menu) {
    if (menu.querySelector('[data-engineering-entry]')) return;
    const group = menu.querySelector('.menu-group');
    const header = group?.querySelector('.group-header');
    if (!header) return;
    const entry = group.cloneNode(false);
    const row = header.cloneNode(false);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-btn';
    for (const name of header.getAttributeNames()) {
      if (name.startsWith('data-v-')) button.setAttribute(name, '');
    }
    button.textContent = '工程分析 / 三维模型与专业资料';
    button.style.width = '100%';
    button.onclick = () => openWorkspace(!app.querySelector('.layout:not(.embed) .sider'));
    entry.dataset.engineeringEntry = '';
    row.append(button);
    entry.append(row);
    menu.append(entry);
  }

  function mountEntries() {
    addAdminButton(app.querySelector('.layout:not(.embed) .sider nav.menu'));
    for (const menu of app.querySelectorAll('.function-area .menu-scroll-content')) addDashboardButton(menu);
  }

  new MutationObserver(mountEntries).observe(app, { childList: true, subtree: true });
  mountEntries();
})();
