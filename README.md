# Model Registry GitLab Pages

This repository hosts a simple GitLab Pages site that acts as a lightweight registry of **project releases** using the GitLab API to gather release information. It is designed to be:

- **low drag** and easy to update – just commit to this repo and GitLab CI will publish a new site.
- **searchable** via client‑side search powered by [Fuse.js](https://fusejs.io/).
- **visible** by publishing on the `main` branch; the page will be available at `https://<your‑group>.gitlab.io/<project>`.
- Able to include additional documentation such as lessons learned and research write‑ups.

## How it works

- Static files live in the `docs/` directory.
- The pipeline defined in `.gitlab-ci.yml` copies `docs/` into the published `public/` artifact.
- JavaScript in `docs/js/main.js` performs a `fetch` request to the GitLab API to list repository tree items for a given project ID.
- Results are rendered on the page and can be filtered with the search box.

## Configuration

1. Set `PROJECT_ID` in `docs/js/main.js` to the numeric ID or URL‑encoded path of your GitLab project or group.
2. If the project is private, supply a `PRIVATE_TOKEN` via CI/CD environment variables (avoid embedding it in the repo). The pipeline will inject these values at build time.
3. The CI job now pre‑generates an `assets.json` file by calling the GitLab API for project releases before the site is copied. This ensures the release list is ready when the page loads and reduces rate‑limit issues.

   The relevant portion of `.gitlab-ci.yml` looks like:

```yaml
pages:
  stage: deploy
  image: python:3.11-slim
  before_script:
    - pip install requests
  script:
    - if [ -n "$PROJECT_ID" ]; then python3 scripts/gen_assets.py; fi
    - mkdir .public
    - cp -r docs/* .public
    # inject project ID / token if provided by CI variables
    - if [ -n "$PROJECT_ID" ]; then sed -i "s|<PROJECT_ID>|$PROJECT_ID|" .public/js/main.js; fi
    - if [ -n "$PRIVATE_TOKEN" ]; then sed -i "s|<PRIVATE_TOKEN>|$PRIVATE_TOKEN|" .public/js/main.js; fi
    - mv .public public
```

4. Commit and push to `main`; GitLab Pages will rebuild and the generated `assets.json` will be included in the published site.

## Extending the site

- Add additional HTML pages under `docs/` for more content.
- Write release notes, lessons, or other information under the `lessons.html` page or elsewhere.
- You can generate pages from Markdown using Jekyll or another static site generator if the project grows.

## Search and filters

The registry page now provides multiple controls:

- A **search box** (fuzzy, case-insensitive) that matches release names, tag names, project names, namespace/team fields, or asset names when assets are shown.
- A **team/group dropdown** automatically populated from the release list; select one to filter results to that namespace.
- A **sort selector** letting you order results by release date, creation date, tag name, or project.
These enhancements make it easy to browse releases across different teams or subgroups and to surface recent or important milestones. Click a release title to open it on GitLab; expand the "Show assets" section to view downloadable artifacts (generated from either `assets.links` or `assets.sources` in GitLab API).

## Lessons & research

See the `Lessons & Research` link on the navigation bar to record findings, design notes, or project documentation.

---

This repository is meant as a starting point; adapt it to your group’s needs and keep it updated as the underlying assets evolve.
