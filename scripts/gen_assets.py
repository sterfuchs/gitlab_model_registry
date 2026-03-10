#!/usr/bin/env python3
import os, sys, requests, json

API_BASE = 'https://gitlab.com/api/v4'
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
                rel['release_url'] = rel['_links']['self']
            else:
                # construct from namespace/project/tag
                rel['release_url'] = f"https://gitlab.com/{namespace}/{project_name}/-/releases/{rel.get('tag_name','')}"
            releases.append(rel)
        if len(data) < 100:
            break
        page += 1
    return releases

# determine whether PROJECT_ID is a group or project
assets = []
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
            assets.extend(fetch_project_releases(proj['id'], ns, proj['path']))
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
    assets = fetch_project_releases(proj['id'], ns, proj.get('path', ''))

with open('docs/assets.json', 'w') as f:
    json.dump(assets, f, indent=2)
print(f"Wrote {len(assets)} releases to docs/assets.json")
