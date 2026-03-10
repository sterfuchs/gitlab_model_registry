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
      'project_name','namespace',
      'releases.name','releases.tag_name','releases.description',
      'releases.assets.links.name','releases.assets.sources.format','releases.assets.sources.url'
    ],
    sortOptions: [
      { value: 'project_name', label: 'Project name' },
      { value: 'namespace', label: 'Namespace' }
    ],
    searchPlaceholder: 'Search releases...'
  },
  models: {
    fetch: fetchModels,
    display: displayModels,
    fuseKeys: ['project_name','namespace', 'models.name','models.description'],
    sortOptions: [
      { value: 'project_name', label: 'Project name' },
      { value: 'namespace', label: 'Namespace' }
    ],
    searchPlaceholder: 'Search models...'
  }
};


// render results to page for releases
function displayReleases(projects) {
  const results = document.getElementById('results');
  results.innerHTML = '';
  if (projects.length === 0) {
    results.innerHTML = '<p>No projects with releases found.</p>';
    return;
  }

  for (const proj of projects) {
    const projDiv = document.createElement('div');
    projDiv.className = 'project';
    const projTitle = document.createElement('h2');
    projTitle.textContent = `${proj.namespace}/${proj.project_name}`;
    projDiv.appendChild(projTitle);

    if (proj.releases && proj.releases.length > 0) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `Show releases (${proj.releases.length})`;
      details.appendChild(summary);

      for (const rel of proj.releases) {
        const relDiv = document.createElement('div');
        relDiv.className = 'release';
        const relTitle = document.createElement('h3');
        // hyperlink to release page
        const link = document.createElement('a');
        link.href = rel.release_url || '#';
        link.textContent = rel.name;
        link.target = '_blank';
        relTitle.appendChild(link);

        const info = document.createElement('p');
        const date = rel.released_at || rel.created_at || 'n/a';
        const assetsCount = rel.assets && rel.assets.count != null ? rel.assets.count : 'n/a';
        info.textContent = `tag: ${rel.tag_name || ''}, released: ${date}, asset count: ${assetsCount}`;

        relDiv.appendChild(relTitle);
        relDiv.appendChild(info);

        if (rel.description) {
          const desc = document.createElement('p');
          desc.textContent = rel.description;
          desc.style.fontStyle = 'italic';
          relDiv.appendChild(desc);
        }

        // assets dropdown
        const assetLinks = [];
        if (rel.assets) {
          if (Array.isArray(rel.assets.links)) assetLinks.push(...rel.assets.links);
          if (Array.isArray(rel.assets.sources)) {
            for (const s of rel.assets.sources) {
              assetLinks.push({ name: s.format || s.name || s.url, url: s.url });
            }
          }
        }
        if (assetLinks.length > 0) {
          const assetDetails = document.createElement('details');
          const assetSummary = document.createElement('summary');
          assetSummary.textContent = `Show assets (${assetLinks.length})`;
          assetDetails.appendChild(assetSummary);
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
          assetDetails.appendChild(ul);
          relDiv.appendChild(assetDetails);
        }

        details.appendChild(relDiv);
      }
      projDiv.appendChild(details);
    }
    results.appendChild(projDiv);
  }
}

// render results for models
function displayModels(projects) {
  const results = document.getElementById('results');
  results.innerHTML = '';
  if (projects.length === 0) {
    results.innerHTML = '<p>No projects with models found.</p>';
    return;
  }

  for (const proj of projects) {
    const projDiv = document.createElement('div');
    projDiv.className = 'project';
    const projTitle = document.createElement('h2');
    projTitle.textContent = `${proj.namespace}/${proj.project_name}`;
    projDiv.appendChild(projTitle);

    if (proj.models && proj.models.length > 0) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `Show models (${proj.models.length})`;
      details.appendChild(summary);

      for (const m of proj.models) {
        const mDiv = document.createElement('div');
        mDiv.className = 'model';
        const title = document.createElement('h3');
        title.textContent = m.name || 'unnamed model';
        mDiv.appendChild(title);
        const info = document.createElement('p');
        info.textContent = `version: ${m.version || m.tag || ''}`;
        mDiv.appendChild(info);
        if (m.description) {
          const desc = document.createElement('p');
          desc.textContent = m.description;
          desc.style.fontStyle = 'italic';
          mDiv.appendChild(desc);
        }
        // link to model page if available
        if (m.url) {
          const link = document.createElement('a');
          link.href = m.url;
          link.textContent = 'View in registry';
          link.target = '_blank';
          mDiv.appendChild(link);
        }
        details.appendChild(mDiv);
      }
      projDiv.appendChild(details);
    }
    results.appendChild(projDiv);
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
