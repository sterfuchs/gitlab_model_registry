// Configuration - update PROJECT_ID to your GitLab project or group as needed
const GITLAB_API_BASE = 'https://gitlab.com/api/v4';
const PROJECT_ID = '<PROJECT_ID>'; // e.g. 123456 or 'namespace%2Fproject'
// optional token (if private project) - set via build-time injection or use gitlab pages environment variable
const PRIVATE_TOKEN = ''; // leave blank for public projects

async function fetchReleases() {
  // try pre-generated JSON (CI) first
  try {
    const resp = await fetch('assets.json');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    // ignore and fall back
  }

  // fallback: live API call (unlikely to run on pages)
  const url = `${GITLAB_API_BASE}/projects/${PROJECT_ID}/repository/tree?recursive=true&per_page=100`;
  const headers = {};
  if (PRIVATE_TOKEN) headers['PRIVATE-TOKEN'] = PRIVATE_TOKEN;

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    console.error('Failed to fetch releases', resp.status, resp.statusText);
    return [];
  }

  const tree = await resp.json();
  return tree.filter(item => item.type === 'blob');
}

async function fetchModels() {
  try {
    const resp = await fetch('models.json');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    // ignore
  }
  // no fallback API implemented for models
  return [];
}

// view management
let currentView = 'releases';
const dataStore = { releases: null, models: null };

const viewConfig = {
  releases: {
    fetch: fetchReleases,
    display: displayReleases,
    fuseKeys: [
      'name','tag_name','description','project_name','namespace',
      'assets.links.name','assets.sources.format','assets.sources.url'
    ],
    sortOptions: [
      { value: 'released_at', label: 'Released date' },
      { value: 'created_at', label: 'Created date' },
      { value: 'tag_name', label: 'Tag name' },
      { value: 'project_name', label: 'Project' },
      { value: 'assets_count', label: 'Asset count' }
    ],
    searchPlaceholder: 'Search releases...'
  },
  models: {
    fetch: fetchModels,
    display: displayModels,
    fuseKeys: ['name','description','project_name','namespace'],
    sortOptions: [
      { value: 'name', label: 'Name' },
      { value: 'version', label: 'Version' }
    ],
    searchPlaceholder: 'Search models...'
  }
};


// render results to page for releases
function displayReleases(list) {
  const results = document.getElementById('results');
  results.innerHTML = ''; // clear
  if (list.length === 0) {
    results.innerHTML = '<p>No releases found.</p>';
    return;
  }

  for (const rel of list) {
    const div = document.createElement('div');
    div.className = 'asset';
    const title = document.createElement('h3');
    // hyperlink to release page
    const link = document.createElement('a');
    link.href = rel.release_url || '#';
    link.textContent = `${rel.project_name || 'unknown'} — ${rel.name}`;
    link.target = '_blank';
    title.appendChild(link);

    const info = document.createElement('p');
    const ns = rel.namespace ? ` [${rel.namespace}]` : '';
    const date = rel.released_at || rel.created_at || 'n/a';
    const assetsCount = rel.assets && rel.assets.count != null ? rel.assets.count : 'n/a';
    info.textContent = `tag: ${rel.tag_name || ''}${ns}, released: ${date}, asset count: ${assetsCount}`;

    if (rel.description) {
      const desc = document.createElement('p');
      desc.textContent = rel.description;
      desc.style.fontStyle = 'italic';
      div.appendChild(desc);
    }

    div.appendChild(title);
    div.appendChild(info);

    // if there are linked assets, add a collapsible section
    // assets may appear under 'links' or 'sources'
    const assetLinks = [];
    if (rel.assets) {
      if (Array.isArray(rel.assets.links)) assetLinks.push(...rel.assets.links);
      if (Array.isArray(rel.assets.sources)) {
        // normalize source to same shape
        for (const s of rel.assets.sources) {
          assetLinks.push({ name: s.format || s.name || s.url, url: s.url });
        }
      }
    }
    if (assetLinks.length > 0) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `Show assets (${assetLinks.length})`;
      details.appendChild(summary);
      const ul = document.createElement('ul');
      for (const a of assetLinks) {
        const li = document.createElement('li');
        const aTag = document.createElement('a');
        aTag.href = a.url;
        aTag.textContent = a.name || a.url;
        aTag.target = '_blank';
        li.appendChild(aTag);
        ul.appendChild(li);
      }
      details.appendChild(ul);
      div.appendChild(details);
    }

    results.appendChild(div);
  }
}

// render results for models
function displayModels(list) {
  const results = document.getElementById('results');
  results.innerHTML = '';
  if (list.length === 0) {
    results.innerHTML = '<p>No models found.</p>';
    return;
  }
  for (const m of list) {
    const div = document.createElement('div');
    div.className = 'asset';
    const title = document.createElement('h3');
    title.textContent = m.name || 'unnamed model';
    div.appendChild(title);
    const info = document.createElement('p');
    const ns = m.namespace ? ` [${m.namespace}]` : '';
    info.textContent = `version: ${m.version || m.tag || ''}${ns}`;
    div.appendChild(info);
    if (m.description) {
      const desc = document.createElement('p');
      desc.textContent = m.description;
      desc.style.fontStyle = 'italic';
      div.appendChild(desc);
    }
    // link to model page if available
    if (m.url) {
      const link = document.createElement('a');
      link.href = m.url;
      link.textContent = 'View in registry';
      link.target = '_blank';
      div.appendChild(link);
    }
    results.appendChild(div);
  }
}

function setupFilters(data) {
  const nsSelect = document.getElementById('filter-namespace');
  nsSelect.innerHTML = '<option value="">All teams/groups</option>';
  const namespaces = Array.from(new Set(data.map(d => d.namespace).filter(Boolean))).sort();
  for (const ns of namespaces) {
    const opt = document.createElement('option');
    opt.value = ns;
    opt.textContent = ns;
    nsSelect.appendChild(opt);
  }
}

function updateControls(view) {
  const cfg = viewConfig[view];
  document.getElementById('search').placeholder = cfg.searchPlaceholder;
  const sort = document.getElementById('sort-by');
  sort.innerHTML = '';
  for (const o of cfg.sortOptions) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sort.appendChild(opt);
  }
}

function sortAssets(list, criterion) {
  return list.slice().sort((a, b) => {
    if (criterion === 'released_at' || criterion === 'created_at') {
      return new Date(a[criterion] || 0) - new Date(b[criterion] || 0);
    }
    if (criterion === 'assets_count') {
      return (a.assets && a.assets.count ? a.assets.count : 0) - (b.assets && b.assets.count ? b.assets.count : 0);
    }
    return (a[criterion] || '').localeCompare(b[criterion] || '');
  });
}

function applyAll(data, fuse) {
  let list = data;
  const query = document.getElementById('search').value.trim();
  if (query) {
    list = fuse.search(query).map(r => r.item);
  }
  const nsVal = document.getElementById('filter-namespace').value;
  if (nsVal) {
    list = list.filter(i => i.namespace === nsVal);
  }
  const sortVal = document.getElementById('sort-by').value;
  if (sortVal) {
    list = sortAssets(list, sortVal);
  }
  const cfg = viewConfig[currentView];
  cfg.display(list);
}

function setupSearch(data) {
  const cfg = viewConfig[currentView];
  const fuse = new Fuse(data, {
    keys: cfg.fuseKeys,
    threshold: 0.3,
  });

  setupFilters(data);

  const input = document.getElementById('search');
  const nsSelect = document.getElementById('filter-namespace');
  const sortSelect = document.getElementById('sort-by');

  input.addEventListener('input', () => applyAll(data, fuse));
  nsSelect.addEventListener('change', () => applyAll(data, fuse));
  sortSelect.addEventListener('change', () => applyAll(data, fuse));
}

async function loadView(view) {
  const cfg = viewConfig[view];
  updateControls(view);
  let data = dataStore[view];
  if (!data) {
    data = await cfg.fetch();
    dataStore[view] = data;
  }
  setupSearch(data);
  const fuse = new Fuse(data, { keys: cfg.fuseKeys, threshold: 0.3 });
  applyAll(data, fuse);
}

function switchTab(view) {
  if (currentView === view) return;
  currentView = view;
  document.querySelectorAll('#view-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  loadView(view);
}

(async function init() {
  // attach tab handlers
  document.querySelectorAll('#view-tabs button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });
  // initial load
  await loadView(currentView);
})();
