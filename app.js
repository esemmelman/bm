const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const APP_VERSION = '1.3.0';
const APP_RELEASE_DESCRIPTION = 'Contact information';

const clientConfigured = !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
const db = clientConfigured && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const connectionStatus = document.getElementById('connectionStatus');
const appVersion = document.getElementById('appVersion');
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
const assignmentView = document.getElementById('assignmentView');
const assignmentTitle = document.getElementById('assignmentTitle');
const assignmentRootName = document.getElementById('assignmentRootName');
const taskForm = document.getElementById('taskForm');
const taskName = document.getElementById('taskName');
const taskFormMessage = document.getElementById('taskFormMessage');
const tasksElement = document.getElementById('tasks');
const taskCount = document.getElementById('taskCount');
const rootContextMenu = document.getElementById('rootContextMenu');
const addAssignmentAction = document.getElementById('addAssignmentAction');
const deleteRootAction = document.getElementById('deleteRootAction');
const contactView = document.getElementById('contactView');
const contactTitle = document.getElementById('contactTitle');
const contactForm = document.getElementById('contactForm');
const contactInfo = document.getElementById('contactInfo');
const contactFormMessage = document.getElementById('contactFormMessage');

let roots = [];
let assignments = [];
let tasks = [];
let contacts = [];
let contactInfos = [];
let selectedRootId = null;
let selectedAssignmentId = null;
let selectedContactId = null;
let contextRootId = null;
const expandedRootIds = new Set();

appVersion.textContent = `v${APP_VERSION} · ${APP_RELEASE_DESCRIPTION}`;

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
    rootButton.setAttribute('aria-current', String(root.id === selectedRootId && !selectedAssignmentId && !selectedContactId));
    rootButton.title = 'Click to expand or collapse. Right-click to add an assignment.';

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
    rootButton.oncontextmenu = event => {
      event.preventDefault();
      openRootContextMenu(event, root.id);
    };

    const logButton = document.createElement('button');
    logButton.type = 'button';
    logButton.className = 'tree-item tree-child';
    logButton.textContent = 'Log';
    logButton.setAttribute('aria-current', String(root.id === selectedRootId && !selectedAssignmentId && !selectedContactId));
    logButton.hidden = !expandedRootIds.has(root.id);
    logButton.onclick = () => selectRoot(root.id);

    group.append(rootButton, logButton);

    const contact = contacts.find(item => item.parent_id === root.id);
    if (contact) {
      const contactButton = document.createElement('button');
      contactButton.type = 'button';
      contactButton.className = 'tree-item tree-child contact-node';
      contactButton.textContent = 'Contact';
      contactButton.hidden = !expandedRootIds.has(root.id);
      contactButton.setAttribute('aria-current', String(contact.id === selectedContactId));
      contactButton.onclick = () => selectContact(contact.id);
      group.append(contactButton);
    }

    assignments
      .filter(assignment => assignment.parent_id === root.id)
      .forEach(assignment => {
        const assignmentButton = document.createElement('button');
        assignmentButton.type = 'button';
        assignmentButton.className = 'tree-item tree-child assignment-node';
        assignmentButton.textContent = assignment.name;
        assignmentButton.hidden = !expandedRootIds.has(root.id);
        assignmentButton.setAttribute('aria-current', String(assignment.id === selectedAssignmentId));
        assignmentButton.onclick = () => selectAssignment(assignment.id);
        group.append(assignmentButton);
      });
    tree.append(group);
  });
}

function openRootContextMenu(event, rootId) {
  contextRootId = rootId;
  rootContextMenu.hidden = false;

  const menuWidth = 190;
  const menuHeight = 96;
  rootContextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - menuWidth - 8)}px`;
  rootContextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - menuHeight - 8)}px`;
  addAssignmentAction.focus();
}

function closeRootContextMenu() {
  rootContextMenu.hidden = true;
  contextRootId = null;
}

async function createAssignment(root) {
  const value = prompt(`Name the assignment for ${root.name}:`);
  if (value === null) return;
  const name = value.trim();
  if (!name) {
    alert('Enter a name for the assignment.');
    return;
  }

  const { data, error } = await db
    .from('bm_nodes')
    .insert({ name, parent_id: root.id, node_type: 'assignment' })
    .select('id, name, parent_id, node_type, created_at')
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  assignments.push(data);
  expandedRootIds.add(root.id);
  selectAssignment(data.id);
}

async function deleteRoot(root) {
  const confirmed = confirm(
    `Delete ${root.name} and everything underneath it?\n\nThis includes its Log, assignments, tasks, and log entries. This cannot be undone.`
  );
  if (!confirmed) return;

  const { error } = await db
    .from('bm_nodes')
    .delete()
    .eq('id', root.id);

  if (error) {
    alert(`The family could not be deleted: ${error.message}`);
    return;
  }

  const removedAssignmentIds = new Set(
    assignments
      .filter(assignment => assignment.parent_id === root.id)
      .map(assignment => assignment.id)
  );
  const removedContactIds = new Set(
    contacts
      .filter(contact => contact.parent_id === root.id)
      .map(contact => contact.id)
  );
  roots = roots.filter(item => item.id !== root.id);
  assignments = assignments.filter(assignment => assignment.parent_id !== root.id);
  tasks = tasks.filter(task => !removedAssignmentIds.has(task.parent_id));
  contacts = contacts.filter(contact => contact.parent_id !== root.id);
  contactInfos = contactInfos.filter(info => !removedContactIds.has(info.parent_id));
  expandedRootIds.delete(root.id);

  if (selectedRootId === root.id) {
    selectedRootId = null;
    selectedAssignmentId = null;
    selectedContactId = null;
    logView.hidden = true;
    assignmentView.hidden = true;
    contactView.hidden = true;
    welcome.hidden = false;
  }

  renderTree();
}

addAssignmentAction.onclick = () => {
  const root = roots.find(item => item.id === contextRootId);
  closeRootContextMenu();
  if (root) createAssignment(root);
};

deleteRootAction.onclick = () => {
  const root = roots.find(item => item.id === contextRootId);
  closeRootContextMenu();
  if (root) deleteRoot(root);
};

document.addEventListener('click', event => {
  if (!rootContextMenu.hidden && !rootContextMenu.contains(event.target)) {
    closeRootContextMenu();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !rootContextMenu.hidden) {
    closeRootContextMenu();
  }
});

window.addEventListener('blur', closeRootContextMenu);

async function loadRoots() {
  if (!db) {
    showSetupMessage();
    return;
  }

  const { data, error } = await db
    .from('bm_nodes')
    .select('id, name, parent_id, node_type, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    setStatus('Database error', 'error');
    emptyTree.textContent = error.message;
    return;
  }

  roots = data.filter(node => node.parent_id === null);
  assignments = data.filter(node => node.node_type === 'assignment');
  tasks = data.filter(node => node.node_type === 'task');
  contacts = data.filter(node => node.node_type === 'contact');
  contactInfos = data.filter(node => node.node_type === 'contact_info');

  const rootsWithoutContacts = roots.filter(
    root => !contacts.some(contact => contact.parent_id === root.id)
  );
  if (rootsWithoutContacts.length) {
    const { data: newContacts, error: contactError } = await db
      .from('bm_nodes')
      .insert(rootsWithoutContacts.map(root => ({
        name: 'Contact',
        parent_id: root.id,
        node_type: 'contact'
      })))
      .select('id, name, parent_id, node_type, created_at');

    if (contactError) {
      setStatus('Database error', 'error');
      emptyTree.textContent = `Contacts could not be created: ${contactError.message}`;
      return;
    }
    contacts.push(...newContacts);
  }
  roots.forEach(root => expandedRootIds.add(root.id));
  setStatus('Connected', 'ready');
  renderTree();
}

async function selectRoot(id) {
  selectedRootId = id;
  selectedAssignmentId = null;
  selectedContactId = null;
  const root = roots.find(item => item.id === id);
  if (!root) return;

  renderTree();
  welcome.hidden = true;
  logView.hidden = false;
  assignmentView.hidden = true;
  contactView.hidden = true;
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

function selectAssignment(id) {
  const assignment = assignments.find(item => item.id === id);
  if (!assignment) return;
  const root = roots.find(item => item.id === assignment.parent_id);

  selectedAssignmentId = id;
  selectedContactId = null;
  selectedRootId = assignment.parent_id;
  welcome.hidden = true;
  logView.hidden = true;
  assignmentView.hidden = false;
  contactView.hidden = true;
  assignmentTitle.textContent = assignment.name;
  assignmentRootName.textContent = root ? root.name : '';
  taskFormMessage.textContent = '';
  renderTasks();
  renderTree();
}

function selectContact(id) {
  const contact = contacts.find(item => item.id === id);
  if (!contact) return;
  const root = roots.find(item => item.id === contact.parent_id);
  const info = contactInfos.find(item => item.parent_id === contact.id);

  selectedContactId = id;
  selectedAssignmentId = null;
  selectedRootId = contact.parent_id;
  welcome.hidden = true;
  logView.hidden = true;
  assignmentView.hidden = true;
  contactView.hidden = false;
  contactTitle.textContent = root ? root.name : 'Contact';
  contactInfo.value = info ? info.name : '';
  contactFormMessage.textContent = '';
  renderTree();
}

function renderTasks() {
  const assignmentTasks = tasks.filter(task => task.parent_id === selectedAssignmentId);
  tasksElement.replaceChildren();
  taskCount.textContent = `${assignmentTasks.length} ${assignmentTasks.length === 1 ? 'task' : 'tasks'}`;

  if (!assignmentTasks.length) {
    const empty = document.createElement('p');
    empty.className = 'no-entries';
    empty.textContent = 'No tasks yet. Add the first task above.';
    tasksElement.append(empty);
    return;
  }

  assignmentTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-item';
    const marker = document.createElement('span');
    marker.className = 'task-marker';
    marker.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = task.name;
    item.append(marker, label);
    tasksElement.append(item);
  });
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

  const { data: childNodes, error: childError } = await db
    .from('bm_nodes')
    .insert([
      { name: 'Log', parent_id: root.id, node_type: 'log' },
      { name: 'Contact', parent_id: root.id, node_type: 'contact' }
    ])
    .select('id, name, parent_id, node_type, created_at');

  if (childError) {
    await db.from('bm_nodes').delete().eq('id', root.id);
    alert(`The Log and Contact could not be created: ${childError.message}`);
    submitButton.disabled = false;
    return;
  }

  roots.push(root);
  contacts.push(...childNodes.filter(node => node.node_type === 'contact'));
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

taskForm.onsubmit = async event => {
  event.preventDefault();
  const name = taskName.value.trim();
  if (!name || !selectedAssignmentId || !db) return;

  const submitButton = taskForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  taskFormMessage.textContent = 'Saving...';

  const { data, error } = await db
    .from('bm_nodes')
    .insert({ name, parent_id: selectedAssignmentId, node_type: 'task' })
    .select('id, name, parent_id, node_type, created_at')
    .single();

  submitButton.disabled = false;
  if (error) {
    taskFormMessage.textContent = error.message;
    return;
  }

  tasks.push(data);
  taskForm.reset();
  taskFormMessage.textContent = 'Saved';
  renderTasks();
  taskName.focus();
};

contactForm.onsubmit = async event => {
  event.preventDefault();
  if (!selectedContactId || !db) return;

  const value = contactInfo.value.trim();
  const submitButton = contactForm.querySelector('[type="submit"]');
  const existingInfo = contactInfos.find(info => info.parent_id === selectedContactId);
  submitButton.disabled = true;
  contactFormMessage.textContent = 'Saving...';

  let result;
  if (existingInfo) {
    result = await db
      .from('bm_nodes')
      .update({ name: value })
      .eq('id', existingInfo.id)
      .select('id, name, parent_id, node_type, created_at')
      .single();
  } else {
    result = await db
      .from('bm_nodes')
      .insert({ name: value, parent_id: selectedContactId, node_type: 'contact_info' })
      .select('id, name, parent_id, node_type, created_at')
      .single();
  }

  submitButton.disabled = false;
  if (result.error) {
    contactFormMessage.textContent = result.error.message;
    return;
  }

  if (existingInfo) {
    const index = contactInfos.findIndex(info => info.id === existingInfo.id);
    contactInfos[index] = result.data;
  } else {
    contactInfos.push(result.data);
  }
  contactFormMessage.textContent = 'Saved';
};

loadRoots();
