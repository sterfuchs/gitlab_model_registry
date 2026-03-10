#!/usr/bin/env python3
import os, sys, requests, json

API_BASE = 'https://gitlab.com/api/v4'
GITLAB_INSTANCE = 'https://gitlab.com'
PROJECT_ID = os.environ.get('PROJECT_ID')
TOKEN = os.environ.get('PRIVATE_TOKEN', '')

if not PROJECT_ID:
    sys.exit(0)

headers = {}
if TOKEN:
    headers['PRIVATE-TOKEN'] = TOKEN

def fetch_project_models(proj_id, namespace, project_name):
    models = []
    page = 1
    while True:
        params = {'package_type': 'ml_model', 'per_page': 100, 'page': page}
        resp = requests.get(f"{API_BASE}/projects/{proj_id}/packages", headers=headers, params=params)
        if not resp.ok:
            print(f"Failed to fetch models page {page} for {proj_id}: {resp.status_code} {resp.text}", file=sys.stderr)
            sys.exit(1)
        data = resp.json()
        if not data:
            break
        for pkg in data:
            pkg['namespace'] = namespace
            pkg['project_name'] = project_name
            web_path = pkg.get('_links', {}).get('web_path', '')
            if web_path.startswith('/'):
                pkg['url'] = GITLAB_INSTANCE + web_path
            else:
                pkg['url'] = web_path
            models.append(pkg)
        if len(data) < 100:
            break
        page += 1
    return models

# determine whether PROJECT_ID is a group or project
projects_data = []
# try group endpoint first
grp_resp = requests.get(f"{API_BASE}/groups/{PROJECT_ID}", headers=headers)
if grp_resp.ok:
    # treat as group: fetch all projects under it
    pg = 1
    while True:
        projects = requests.get(f"{API_BASE}/groups/{PROJECT_ID}/projects", headers=headers, params={'per_page': 100, 'page': pg}).json()
        if not projects:
            break
        for proj in projects:
            ns = proj.get('namespace', {}).get('full_path', PROJECT_ID)
            models = fetch_project_models(proj['id'], ns, proj['path'])
            if models:  # only include projects with models
                projects_data.append({
                    'project_name': proj['path'],
                    'namespace': ns,
                    'models': models
                })
        if len(projects) < 100:
            break
        pg += 1
else:
    # fallback to project
    proj_resp = requests.get(f"{API_BASE}/projects/{PROJECT_ID}", headers=headers)
    if not proj_resp.ok:
        print(f"Unable to lookup project or group {PROJECT_ID}", file=sys.stderr)
        sys.exit(1)
    proj = proj_resp.json()
    ns = proj.get('namespace', {}).get('full_path', PROJECT_ID)
    models = fetch_project_models(proj['id'], ns, proj.get('path', ''))
    projects_data.append({
        'project_name': proj.get('path', ''),
        'namespace': ns,
        'models': models
    })

with open('docs/models.json', 'w') as f:
    json.dump(projects_data, f, indent=2)
print(f"Wrote {len(projects_data)} projects with models to docs/models.json")
