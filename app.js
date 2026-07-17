const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';

const clientConfigured = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const db = clientConfigured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const connectionStatus = document.getElementById('connectionStatus');
const newRootButton = document.getElementById('newRootButton');
const rootForm = document.getElementById('rootForm');
const rootName = document.getElementById('rootName');
const cancelRootButton = document.getElementById('cancelRootButton');
const tree = document.getElementById('tree');
const emptyTree = document.getElementById('emptyTree');
const welcome = document.getElementById('welcome');
const logView = document.getElementById('logView');
const selectedTitle = document.getElementById('selectedTitle');
const logForm = document.getElementById('logForm');
const logEntry = document.getElementById('logEntry');
const formMessage = document.getElementById('formMessage');
const entries = document.getElementById('entries');
const entryCount = document.getElementById('entryCount');

let roots = [];
let selectedRootId = null;
const expandedRootIds = new Set();

function setStatus(message, state) {
  connectionStatus.textContent = message;
  connectionStatus.dataset.state = state;
}

function showSetupMessage() {
  setStatus('Setup needed', 'error');
  emptyTree.hidden = false;
  emptyTree.textContent = 'Add your Supabase URL and publishable key at the top of app.js, then create the bm_nodes and bm_log_entries tables.';
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function renderTree() {
  tree.replaceChildren();
  emptyTree.hidden = roots.length > 0;

  roots.forEach(root => {
    const group = document.createElement('div');
    group.className = 'tree-group';

    const rootButton = document.createElement('button');
    rootButton.type = 'button';
    rootButton.className = 'tree-item';
    rootButton.setAttribute('aria-expanded', String(expandedRootIds.has(root.id)));
    rootButton.setAttribute('aria-current', String(root.id === selectedRootId));

    const chevron = document.createElement('span');
    chevron.className = 'tree-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';

    const rootLabel = document.createElement('span');
    rootLabel.textContent = root.name;
    rootButton.append(chevron, rootLabel);
    rootButton.onclick = () => {
      if (expandedRootIds.has(root.id)) {
        expandedRootIds.delete(root.id);
      } else {
        expandedRootIds.add(root.id);
      }
      renderTree();
    };

    const logButton = document.createElement('button');
    logButton.type = 'button';
    logButton.className = 'tree-item tree-child';
    logButton.textContent = 'Log';
    logButton.setAttribute('aria-current', String(root.id === selectedRootId));
    logButton.hidden = !expandedRootIds.has(root.id);
    logButton.onclick = () => selectRoot(root.id);

    group.append(rootButton, logButton);
    tree.append(group);
  });
}

async function loadRoots() {
  if (!db) {
    showSetupMessage();
    return;
  }

  const { data, error } = await db
    .from('bm_nodes')
    .select('id, name, created_at')
    .is('parent_id', null)
    .order('created_at', { ascending: true });

  if (error) {
    setStatus('Database error', 'error');
    emptyTree.textContent = error.message;
    return;
  }

  roots = data;
  roots.forEach(root => expandedRootIds.add(root.id));
  setStatus('Connected', 'ready');
  renderTree();
}

async function selectRoot(id) {
  selectedRootId = id;
  const root = roots.find(item => item.id === id);
  if (!root) return;

  renderTree();
  welcome.hidden = true;
  logView.hidden = false;
  selectedTitle.textContent = root.name;
  entries.innerHTML = '<p class="no-entries">Loading entries...</p>';

  const { data, error } = await db
    .from('bm_log_entries')
    .select('id, body, created_at')
    .eq('root_id', id)
    .order('created_at', { ascending: false });

  if (id !== selectedRootId) return;
  if (error) {
    entries.innerHTML = `<p class="no-entries"></p>`;
    entries.firstElementChild.textContent = error.message;
    return;
  }

  renderEntries(data);
}

function renderEntries(items) {
  entries.replaceChildren();
  entryCount.textContent = `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`;

  if (!items.length) {
    entries.innerHTML = '<p class="no-entries">No entries yet. Add the first update above.</p>';
    return;
  }

  items.forEach(item => {
    const article = document.createElement('article');
    article.className = 'entry';
    const time = document.createElement('time');
    time.dateTime = item.created_at;
    time.textContent = formatDate(item.created_at);
    const body = document.createElement('p');
    body.textContent = item.body;
    article.append(time, body);
    entries.append(article);
  });
}

newRootButton.onclick = () => {
  rootForm.hidden = false;
  rootName.focus();
};

cancelRootButton.onclick = () => {
  rootForm.reset();
  rootForm.hidden = true;
  newRootButton.focus();
};

rootForm.onsubmit = async event => {
  event.preventDefault();
  if (!db) {
    showSetupMessage();
    return;
  }

  const name = rootName.value.trim();
  if (!name) return;
  const submitButton = rootForm.querySelector('[type="submit"]');
  submitButton.disabled = true;

  const { data: root, error: rootError } = await db
    .from('bm_nodes')
    .insert({ name, parent_id: null, node_type: 'root' })
    .select('id, name, created_at')
    .single();

  if (rootError) {
    alert(rootError.message);
    submitButton.disabled = false;
    return;
  }

  const { error: logError } = await db
    .from('bm_nodes')
    .insert({ name: 'Log', parent_id: root.id, node_type: 'log' });

  if (logError) {
    await db.from('bm_nodes').delete().eq('id', root.id);
    alert(`The Log could not be created: ${logError.message}`);
    submitButton.disabled = false;
    return;
  }

  roots.push(root);
  expandedRootIds.add(root.id);
  rootForm.reset();
  rootForm.hidden = true;
  submitButton.disabled = false;
  await selectRoot(root.id);
};

logForm.onsubmit = async event => {
  event.preventDefault();
  const body = logEntry.value.trim();
  if (!body || !selectedRootId || !db) return;

  const submitButton = logForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  formMessage.textContent = 'Saving...';

  const { error } = await db
    .from('bm_log_entries')
    .insert({ root_id: selectedRootId, body });

  submitButton.disabled = false;
  if (error) {
    formMessage.textContent = error.message;
    return;
  }

  logForm.reset();
  formMessage.textContent = 'Saved';
  await selectRoot(selectedRootId);
  logEntry.focus();
};

loadRoots();
