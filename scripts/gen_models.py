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

models = []
page = 1
while True:
    params = {'per_page': 100, 'page': page}
    resp = requests.get(f"{API_BASE}/projects/{PROJECT_ID}/model_registry/models", headers=headers, params=params)
    if not resp.ok:
        print(f"Failed to fetch models page {page}: {resp.status_code} {resp.text}", file=sys.stderr)
        sys.exit(1)
    data = resp.json()
    if not data:
        break
    models.extend(data)
    if len(data) < 100:
        break
    page += 1

# annotate with namespace/project similar to gen_assets if possible
# we don't know group context here; reuse project info
proj_resp = requests.get(f"{API_BASE}/projects/{PROJECT_ID}", headers=headers)
if proj_resp.ok:
    proj = proj_resp.json()
    namespace = proj.get('namespace', {}).get('full_path', PROJECT_ID)
    project_name = proj.get('path', PROJECT_ID)
else:
    namespace = ''
    project_name = ''
for m in models:
    m['namespace'] = namespace
    m['project_name'] = project_name

with open('docs/models.json', 'w') as f:
    json.dump(models, f, indent=2)
print(f"Wrote {len(models)} models to docs/models.json")
