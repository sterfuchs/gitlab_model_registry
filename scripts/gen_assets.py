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



def fetch_project_releases(proj_id, namespace, project_name):
    releases = []
    page = 1
    while True:
        params = {'per_page': 100, 'page': page}
        resp = requests.get(f"{API_BASE}/projects/{proj_id}/releases", headers=headers, params=params)
        if not resp.ok:
            print(f"Failed to fetch releases page {page} for {proj_id}: {resp.status_code} {resp.text}", file=sys.stderr)
            sys.exit(1)
        data = resp.json()
        if not data:
            break
        for rel in data:
            # annotate each release with project/context information
            rel['namespace'] = namespace
            rel['project_name'] = project_name
            # ensure assets links are present even if empty
            rel.setdefault('assets', {}).setdefault('links', [])
            # for convenience, include direct URL to release page if available
            if '_links' in rel and 'self' in rel['_links']:
                self_url = rel['_links']['self']
                if self_url.startswith('/'):
                    rel['release_url'] = GITLAB_INSTANCE + self_url
                else:
                    rel['release_url'] = self_url
            else:
                # construct from namespace/project/tag
                rel['release_url'] = f"{GITLAB_INSTANCE}/{namespace}/{project_name}/-/releases/{rel.get('tag_name','')}"
            releases.append(rel)
        if len(data) < 100:
            break
        page += 1
    return releases

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
            releases = fetch_project_releases(proj['id'], ns, proj['path'])
            if releases:  # only include projects with releases
                projects_data.append({
                    'project_name': proj['path'],
                    'namespace': ns,
                    'releases': releases
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
    releases = fetch_project_releases(proj['id'], ns, proj.get('path', ''))
    projects_data.append({
        'project_name': proj.get('path', ''),
        'namespace': ns,
        'releases': releases
    })

with open('docs/assets.json', 'w') as f:
    json.dump(projects_data, f, indent=2)
print(f"Wrote {len(projects_data)} projects with releases to docs/assets.json")
