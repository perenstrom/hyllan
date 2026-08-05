# Research: Coolify's deploy-trigger API for CI-gated auto-deploy and workflow_dispatch promotion

**Ticket:** [PER-254 — Research Coolify's deploy-trigger API for CI-gated auto-deploy and workflow_dispatch promotion](https://linear.app/per-enstrom/issue/PER-254) (child of PER-250, "Add a Coolify staging environment + manual production promotion")

**Scope:** Production runs on Coolify v4.1.1 today with no auto-deploy configured (manual redeploys only). PER-250 adds (1) a staging Application/Compose resource that auto-deploys, but only after GitHub Actions' `build` and `e2e` jobs pass on `main` — not on Coolify's raw git-push webhook, which fires regardless of CI result — and (2) a `workflow_dispatch` workflow for a human to deliberately trigger a production deploy. This note researches Coolify's own deploy-trigger surface (webhook vs REST API, auth, ref/commit targeting, force-rebuild semantics) against primary sources.

**Note on sourcing:** `coolify.io` is blocked by this environment's network egress policy (a 403 at the proxy level, confirmed via the proxy's own diagnostics — not a site-side block), so the hosted docs site and its API reference pages could not be fetched directly. Coolify's documentation is published from the [`coollabsio/coolify-docs`](https://github.com/coollabsio/coolify-docs) repo (each `content/docs/X/Y.mdx` file is the source for `https://coolify.io/docs/X/Y`, per that repo's own `CLAUDE.md`), and Coolify's REST API is generated from an `openapi.yaml`/`openapi.json` checked into the main [`coollabsio/coolify`](https://github.com/coollabsio/coolify) application repo. This note cites those two repos directly — the same first-party content the docs site and API reference page serve, sourced from the project that owns it, plus the underlying Laravel controllers/routes where the docs are silent on a specific mechanic (commit pinning, force-rebuild semantics). Doc-content citations link to the equivalent hosted `coolify.io/docs` URL; source-code citations link to a GitHub permalink pinned to a specific commit/tag. Where behavior could have drifted since v4.1.1 (the version named in this ticket), both the `v4.1.1` tag and the current `main` branch were checked, and any difference is called out explicitly.

---

## 1. Recommendations (summary)

| Question | Answer |
|---|---|
| 1. How to trigger a deploy from outside the UI | One mechanism, two doors: Coolify's per-resource "Deploy Webhook" URL shown in the UI is not a separate system — it is literally the generic REST endpoint `POST /api/v1/deploy?uuid=<resource-uuid>&force=false`, pre-filled with that resource's UUID. Both "doors" require the same thing: a Bearer API token with the `deploy` permission/ability in the `Authorization` header. There is no separate webhook-secret-in-URL scheme for this endpoint (unlike Coolify's GitHub App git-push webhook, which is HMAC-signed with a distinct secret). |
| 2. Callable from a GitHub Actions step after CI passes? | Yes. Minimal shape: `curl --request POST "https://<coolify-host>/api/v1/deploy?uuid=<uuid>" --header "Authorization: Bearer <token>"` (GET also works on v4.1.1, but was removed from `main` post-v4.1.1 — POST is the version-proof choice). Put the deploy step in a job with `needs: [build, e2e]` (or as the final step of a job that depends on both) so it only runs once CI has passed. |
| 3. Arbitrary git ref/commit vs configured branch? | The public `/api/v1/deploy` endpoint takes no ref/branch/commit parameter for a normal git-based resource. By default it redeploys the resource's already-configured `git_branch` at whatever commit is currently its tip ('HEAD', resolved via `git ls-remote` at deploy time). A resource can be pinned to a specific commit SHA by separately setting the `git_commit_sha` field via `PATCH /api/v1/applications/{uuid}` (undocumented in the docs site's prose, but a real, validated API field) — but this is a persistent configuration change on the resource, not a per-request "deploy this commit" argument, and the commit must still be reachable from the configured branch's clone. |
| 4. Can `workflow_dispatch` target a specific commit/ref for Coolify? | Not directly through `/api/v1/deploy`. "Promotion" via this endpoint is necessarily "redeploy the resource's configured branch's current HEAD" — the `workflow_dispatch` event's own `ref`/`inputs` only control what commit the *GitHub Actions job itself* checks out, not what Coolify deploys. The only way to make Coolify deploy something other than current HEAD is the `git_commit_sha` PATCH-then-deploy trick above, which is source-level, not a documented promotion feature. |
| 5. Force rebuild vs redeploy last build? | Yes, real and documented at the API-parameter level, with source-level confirmation of the mechanics. `force=false` (default): if a Docker image already exists for the exact commit SHA being deployed and the build configuration hasn't changed, Coolify skips the build step entirely and just rolls the existing image out ("Image found ... with the same Git Commit SHA. Build step skipped."). `force=true`: always rebuilds, passing `--no-cache` (and, for Dockerfile builds, `--pull`) to the build command, ignoring any existing image for that commit. |

Detail and sourcing for each below.

---

## 2. The "Deploy Webhook" URL and the REST API are the same endpoint

Coolify's Authorization docs describe Bearer-token auth scoped by a small set of named permissions:

> "Coolify uses Bearer tokens to authenticate API requests. Tokens are scoped to a single team and carry specific permissions that control what data and actions are available." … "Every API request must include a Bearer token in the `Authorization` header."

The permission table lists `deploy` explicitly: *"Trigger deployments and manage deploy webhooks."* ([Coolify Docs: API Authorization](https://coolify.io/docs/api-reference/authorization), source: [`content/docs/api-reference/authorization.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/api-reference/authorization.mdx))

The "Other Git Providers" doc frames the UI's per-resource webhook as *the* deploy trigger for CI-based setups:

> "For Git providers without direct integration, automatic deployments require triggering the deployment via the Deploy Webhook endpoint." … Prerequisites: "1. Create a Coolify API Token … 2. Get the Deploy Webhook URL from your resource (Your resource → `Webhooks` menu → `Deploy Webhook`)"

and gives the exact request shape:

```yaml
- name: Trigger Coolify Deployment
  run: |
    curl --request GET "${{ secrets.COOLIFY_WEBHOOK }}" \
      --header "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
```

([Coolify Docs: Other Git Providers](https://coolify.io/docs/applications/ci-cd/other-providers), source: [`content/docs/applications/ci-cd/other-providers.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/applications/ci-cd/other-providers.mdx))

The dedicated GitHub Actions guide shows the identical pattern (create a `deploy`-scoped token, copy the "Deploy webhook URL" from the resource's Webhook page, `curl` it with the Bearer token as the last CI step) and is explicit about ordering: *"Make sure the **Deploy to Coolify** step comes after all checks and tests so it only runs when everything before it passes."* ([Coolify Docs: GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions), source: [`content/docs/applications/ci-cd/github/actions.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/applications/ci-cd/github/actions.mdx)) — this is the exact "gate on CI" pattern PER-250 wants for staging.

**What the "Deploy webhook URL" actually is**, confirmed at the source: the helper that generates the URL shown in the UI's Webhooks page is a two-line function that simply builds the public REST endpoint with the resource's UUID pre-filled:

```php
function generateDeployWebhook($resource)
{
    $baseUrl = base_url();
    $api = Url::fromString($baseUrl).'/api/v1';
    $endpoint = '/deploy';
    $uuid = data_get($resource, 'uuid');

    return $api.$endpoint."?uuid=$uuid&force=false";
}
```

(source: [`bootstrap/helpers/shared.php:1429-1437`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/bootstrap/helpers/shared.php#L1429-L1437)) — there is no distinct webhook-secret mechanism here (contrast with Coolify's GitHub App git-push webhook, which uses an HMAC-signed secret verified in `App\Http\Controllers\Webhook\Github`, routed separately at `/webhooks/source/github/events`: [`routes/webhooks.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/routes/webhooks.php)). Both "the webhook" and "the API" are the same `/api/v1/deploy` route, gated the same way — a Bearer token with `deploy` ability — which routes/api.php enforces via `->middleware(['api.ability:deploy'])` on both v4.1.1 and current `main` ([`routes/api.php` @ v4.1.1, line 78](https://github.com/coollabsio/coolify/blob/v4.1.1/routes/api.php#L78); [`routes/api.php` @ main, lines 87-88](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/routes/api.php#L87-L88)).

**Implication for PER-250:** there is only one thing to build here, not two — a `deploy`-scoped Coolify API token stored as a GitHub Actions secret, and either the resource's copy-pasted Deploy Webhook URL or the equivalent `/api/v1/deploy?uuid=...` URL assembled by hand from the resource's UUID (also usable as a secret or a plain repo variable, since the UUID isn't sensitive on its own — the Bearer token is what gates it).

---

## 3. Calling it from a GitHub Actions step after CI passes

**Method and headers.** The generated OpenAPI spec (the source for Coolify's hosted API reference pages) declares the route as:

```yaml
/deploy:
  post:
    tags: [Deployments]
    summary: Deploy
    description: 'Deploy by tag or UUID using query parameters or a JSON body.'
    operationId: deploy-by-tag-or-uuid
    parameters:
      - {name: tag, in: query, description: 'Tag name(s). Comma separated list is also accepted.'}
      - {name: uuid, in: query, description: 'Resource UUID(s). Comma separated list is also accepted.'}
      - {name: force, in: query, description: 'Force rebuild (without cache)'}
      - {name: pr, in: query, description: 'Pull Request Id for deploying specific PR builds. Cannot be used with tag parameter.'}
      - {name: pull_request_id, in: query, description: 'Preview deployment identifier. Alias of pr.'}
      - {name: docker_tag, in: query, description: 'Docker image tag for Docker Image preview deployments. Requires pull_request_id.'}
    security: [{bearerAuth: []}]
```

(source: [`openapi.yaml:5410-5469`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/openapi.yaml#L5410-L5469); identical parameter set on the [`v4.1.1` tag](https://github.com/coollabsio/coolify/blob/v4.1.1/openapi.yaml)) — this is the machine-generated source of the hosted API reference page at `coolify.io/docs/api-reference` (not independently fetchable in this environment; see the sourcing note above).

**Version difference worth flagging:** on `v4.1.1`, the route accepts both GET and POST (`Route::match(['get', 'post'], '/deploy', ...)`, [`routes/api.php:78`](https://github.com/coollabsio/coolify/blob/v4.1.1/routes/api.php#L78)) — matching the GET-based `curl` examples in the docs above. On current `main`, GET has been split off and now returns `405` with `{"message": "This endpoint has changed to a POST request."}` ([`app/Http/Controllers/Api/OtherController.php:13-18`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Http/Controllers/Api/OtherController.php#L13-L18); route wiring at [`routes/api.php:87-88`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/routes/api.php#L87-L88)) — i.e. the docs' own GET examples are already stale against a newer Coolify than the ticket's v4.1.1. **Use `POST` in the new workflow regardless of the docs examples** — it works on both v4.1.1 today and whatever Coolify version this VPS is upgraded to later.

**Minimal request:**

```bash
curl --fail --request POST "https://<coolify-host>/api/v1/deploy?uuid=<staging-app-uuid>" \
  --header "Authorization: Bearer ${COOLIFY_TOKEN}"
```

**Wiring it to gate on CI**, per this repo's `.github/workflows/ci.yml` (`build` and `e2e` jobs on `push: branches: [main]`): add a third job in that same workflow with `needs: [build, e2e]`, so it only runs after both succeed on `main`:

```yaml
deploy-staging:
  needs: [build, e2e]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Trigger Coolify staging deploy
      run: |
        curl --fail --request POST "https://<coolify-host>/api/v1/deploy?uuid=${{ secrets.COOLIFY_STAGING_APP_UUID }}" \
          --header "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
```

This is the concrete implementation of the "GitHub Actions provide greater flexibility … ensuring that new versions are deployed to Coolify only after all validations pass" framing in Coolify's own GitHub Actions guide ([Coolify Docs: GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions)), and replaces relying on Coolify's own GitHub App/webhook-based "Auto Deploy" toggle, which redeploys on every push regardless of CI outcome — per Coolify's own docs, enabling the GitHub App "automatically enables 'Auto Deploy' … Coolify will automatically redeploy your application whenever you push changes to your repository," with no CI gate in that path at all ([Coolify Docs: GitHub Auto Deploy](https://coolify.io/docs/applications/ci-cd/github/auto-deploy), source: [`content/docs/applications/ci-cd/github/auto-deploy.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/applications/ci-cd/github/auto-deploy.mdx)). **For the staging resource, "Auto Deploy" (the GitHub App/webhook toggle) should stay off**; the CI-gated `curl` step is the sole deploy trigger.

**Token scope:** create the token with only the `deploy` permission (least privilege, per the Authorization doc's own guidance: *"A CI/CD pipeline might need `read` and `deploy`."*), enable API access instance-wide first (Settings → Advanced → API Access), and store both the token and the resource UUID/webhook URL as GitHub Actions repository secrets ([Coolify Docs: API Authorization](https://coolify.io/docs/api-reference/authorization)).

**Rate limiting:** the API is rate-limited to 200 requests/minute by default (`API_RATE_LIMIT` env var) — irrelevant at this project's deploy frequency, but worth knowing if the same token is reused for polling deployment status. A 429 response includes a `Retry-After` header ([Coolify Docs: API Authorization](https://coolify.io/docs/api-reference/authorization); confirmed in code at [`app/Http/Controllers/Api/DeployController.php:427-429`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Http/Controllers/Api/DeployController.php#L427-L429)).

---

## 4. Deploying an arbitrary ref/commit vs. the configured branch's current HEAD

The `/api/v1/deploy` endpoint's controller resolves which resource(s) to deploy purely from `uuid`/`tag`, plus `force`/`pr`/`pull_request_id`/`docker_tag` for rebuild and PR-preview behavior — there is no `branch`, `ref`, or `commit` query parameter for a normal git-based deploy ([`app/Http/Controllers/Api/DeployController.php:362-396`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Http/Controllers/Api/DeployController.php#L362-L396)).

What actually gets deployed is resolved by `queue_application_deployment()`, which defaults the commit to the application's stored `git_commit_sha`, falling back to the literal string `'HEAD'`:

```php
function queue_application_deployment(Application $application, string $deployment_uuid, ?int $pull_request_id = 0, ?string $commit = null, bool $force_rebuild = false, ...)
{
    $commit = $commit ?: ($application->git_commit_sha ?: 'HEAD');
    ...
```

(source: [`bootstrap/helpers/applications.php:14-16`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/bootstrap/helpers/applications.php#L14-L16)) — and the `DeployController::deploy_resource()` call site that the REST API uses never passes a `$commit` argument at all ([`app/Http/Controllers/Api/DeployController.php:518-525`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Http/Controllers/Api/DeployController.php#L518-L525)), so an API-triggered deploy always resolves to whatever `git_commit_sha` is currently stored on the Application row.

That field defaults to the literal string `'HEAD'` in the database schema itself (`$table->string('git_commit_sha')->default('HEAD');`, [`database/migrations/2023_03_27_081716_create_applications_table.php:25`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/database/migrations/2023_03_27_081716_create_applications_table.php#L25)). When it's `'HEAD'`, `ApplicationDeploymentJob` resolves the actual current tip of the configured branch at deploy time via `git ls-remote` against the resource's configured `git_branch`, and checks out that resolved SHA ([`app/Jobs/ApplicationDeploymentJob.php:2296-2406`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Jobs/ApplicationDeploymentJob.php#L2296-L2406)) — i.e. **the default and API-driven behavior is exactly "redeploy whatever is currently on the resource's configured branch," matching the ticket's assumption.**

**A pinning mechanism exists, but it's a resource-level setting, not a per-request argument.** `git_commit_sha` is a documented, validated, writable field on the Application resource — it appears in the OpenAPI schema for both `create` and `update` application payloads ([`openapi.yaml:100`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/openapi.yaml#L100) et al.) and is updatable via `PATCH /api/v1/applications/{uuid}` under the `write` permission, validated against `regex:/^[a-zA-Z0-9][a-zA-Z0-9._\-\/]*$/` ([`bootstrap/helpers/api.php:137`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/bootstrap/helpers/api.php#L137); route at [`routes/api.php:145`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/routes/api.php#L145)). Setting it to a real SHA short-circuits the `ls-remote` resolution (`shouldResolveBranchHeadCommit()` returns false whenever the commit isn't `'HEAD'`, [`app/Jobs/ApplicationDeploymentJob.php:2401-2406`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Jobs/ApplicationDeploymentJob.php#L2401-L2406)), and the clone step still clones the resource's *configured branch* before checking out that pinned commit (`git clone -b <configured branch>`, then `git checkout <commit>` — [`app/Models/Application.php:1600, 1326-1335`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Models/Application.php#L1600)) — so a pinned commit must be reachable from that branch's history, not an arbitrary ref elsewhere in the repo. This is a real, working mechanism, but it is source-level behavior found by reading the Laravel application, not something surfaced in Coolify's docs prose as a "deploy this commit" feature — treat it as an internal capability, not a stable public contract.

**Net:** for this ticket, "promotion" through `/api/v1/deploy` is, and is intended by Coolify to be, "trigger a redeploy of the resource's already-configured branch's current HEAD." Making sure the right commit is already on that branch before triggering (exactly as the ticket's question 3 frames it) is the correct mental model — not something to route around.

---

## 5. `workflow_dispatch` promotion: can it request a specific commit/ref?

Not through Coolify's deploy API. GitHub's own `workflow_dispatch` event lets a human pick which branch/tag's copy of the *workflow YAML* runs (and pass typed `inputs`), and a `ref` chosen there controls what `actions/checkout` pulls down *inside that GitHub Actions job* — but none of that reaches Coolify. The `/api/v1/deploy` call the workflow makes still only carries `uuid`/`force`/etc. (§4), so Coolify still redeploys the production resource's configured branch's current HEAD, regardless of which ref the `workflow_dispatch` run itself was invoked against.

Concretely, for PER-250's production promotion workflow, a `workflow_dispatch`-triggered job that does:

```yaml
on:
  workflow_dispatch: {}

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Coolify production deploy
        run: |
          curl --fail --request POST "https://<coolify-host>/api/v1/deploy?uuid=${{ secrets.COOLIFY_PROD_APP_UUID }}" \
            --header "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
```

deploys "whatever `main` currently is" — the same thing an automatic deploy would have deployed — not a specific commit chosen at dispatch time. If the ticket wants the human to be able to name an exact commit to promote (rather than always "current main"), the only avenue found is the `git_commit_sha` PATCH-then-deploy sequence from §4 (`PATCH /api/v1/applications/{uuid}` with `git_commit_sha: <sha>`, `write` scope, then `POST /api/v1/deploy?uuid=...`, `deploy` scope) — undocumented as a promotion feature and adds a second API call plus a second token scope. Given PER-250 frames production promotion as "a human deliberately triggers a deploy on demand," not "a human picks an arbitrary past commit to roll forward to," the simpler `workflow_dispatch` → plain `/api/v1/deploy` (current `main` HEAD) model is the better fit and is the recommendation here; flag the `git_commit_sha` route as available-but-unofficial if a future ticket specifically needs commit-level rollback/rollforward.

---

## 6. Force rebuild vs. redeploy last build

Yes — this distinction is real, documented at the parameter level, and has clear source-level mechanics.

**`force` query parameter**, per the OpenAPI spec: *"Force rebuild (without cache)"* ([`openapi.yaml:5430-5435`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/openapi.yaml#L5430-L5435), unchanged since [`v4.1.1`](https://github.com/coollabsio/coolify/blob/v4.1.1/openapi.yaml)).

**What `force=false` (the default) actually does — skips the build if nothing changed:** `ApplicationDeploymentJob::should_skip_build()` checks whether a Docker image already exists for the exact commit SHA being deployed; if one does and the build configuration hasn't changed, it skips straight to rolling the existing image out, logging *"Image found (...) with the same Git Commit SHA. Build step skipped."* — functionally "redeploy last build" whenever the target commit's image is already sitting on the server/registry. If no image exists for that commit (a genuinely new commit) or the build config changed, it builds normally, using Docker's ordinary layer cache. ([`app/Jobs/ApplicationDeploymentJob.php:1259-1300`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Jobs/ApplicationDeploymentJob.php#L1259-L1300))

**What `force=true` does — always rebuilds, no cache:** every buildpack path (Dockerfile, Nixpacks, Railpack, static) skips the `should_skip_build()` short-circuit entirely when `force_rebuild` is true, and the generated build commands add `--no-cache` (and `--pull` for Dockerfile builds, to also refresh the base image) regardless of whether an image already exists for that commit, e.g.:

```php
if ($this->force_rebuild) {
    $build_command = ... "DOCKER_BUILDKIT=1 docker build --no-cache --pull {$this->buildTarget} ...";
}
```

([`app/Jobs/ApplicationDeploymentJob.php:775-776, 912, 2752-2753, 3819-3834`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Jobs/ApplicationDeploymentJob.php#L3819-L3834))

**Implication for PER-250:** the CI-gated staging deploy and the `workflow_dispatch` production deploy should both call `/api/v1/deploy` with `force` omitted/`false` (or explicit `force=false`, matching the UI-generated webhook URL's own default) — this gets Coolify's built-in "skip the build if this exact commit was already built" fast path for free, and only pay for a full rebuild when the commit actually changed or `force=true` is passed deliberately (e.g. a manual "my base image changed upstream, force a clean rebuild" case), not as part of routine promotion.

---

## Sources

**Coolify docs (`coollabsio/coolify-docs`, commit [`fba7290`](https://github.com/coollabsio/coolify-docs/commit/fba7290f6fab3967b167cc08ddc527b9faef235a)):**
- [Coolify Docs: API Authorization](https://coolify.io/docs/api-reference/authorization) — [`content/docs/api-reference/authorization.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/api-reference/authorization.mdx)
- [Coolify Docs: Other Git Providers](https://coolify.io/docs/applications/ci-cd/other-providers) — [`content/docs/applications/ci-cd/other-providers.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/applications/ci-cd/other-providers.mdx)
- [Coolify Docs: GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions) — [`content/docs/applications/ci-cd/github/actions.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/applications/ci-cd/github/actions.mdx)
- [Coolify Docs: GitHub Auto Deploy](https://coolify.io/docs/applications/ci-cd/github/auto-deploy) — [`content/docs/applications/ci-cd/github/auto-deploy.mdx`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/content/docs/applications/ci-cd/github/auto-deploy.mdx)
- [`CLAUDE.md`](https://github.com/coollabsio/coolify-docs/blob/fba7290f6fab3967b167cc08ddc527b9faef235a/CLAUDE.md) (repo → hosted-URL mapping convention)

**Coolify application source (`coollabsio/coolify`, `main` @ [`940571e`](https://github.com/coollabsio/coolify/commit/940571e16f5a0e6c73cf56b4bb1184bed3d60623), and tag [`v4.1.1`](https://github.com/coollabsio/coolify/tree/v4.1.1) @ [`5a27427`](https://github.com/coollabsio/coolify/commit/5a27427cad54e98c21a691a08077c20f94f84f73)):**
- [`openapi.yaml`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/openapi.yaml) — generated OpenAPI spec backing the hosted API reference
- [`app/Http/Controllers/Api/DeployController.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Http/Controllers/Api/DeployController.php)
- [`app/Http/Controllers/Api/OtherController.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Http/Controllers/Api/OtherController.php)
- [`routes/api.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/routes/api.php) (`main`) and [`routes/api.php` @ v4.1.1](https://github.com/coollabsio/coolify/blob/v4.1.1/routes/api.php)
- [`routes/webhooks.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/routes/webhooks.php)
- [`bootstrap/helpers/shared.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/bootstrap/helpers/shared.php) (`generateDeployWebhook`)
- [`bootstrap/helpers/applications.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/bootstrap/helpers/applications.php) (`queue_application_deployment`)
- [`bootstrap/helpers/api.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/bootstrap/helpers/api.php) (`git_commit_sha` validation rule)
- [`app/Models/Application.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Models/Application.php) (`generateGitImportCommands`, `setGitImportSettings`)
- [`app/Jobs/ApplicationDeploymentJob.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/app/Jobs/ApplicationDeploymentJob.php) (branch-HEAD resolution, `should_skip_build`, force-rebuild build commands)
- [`database/migrations/2023_03_27_081716_create_applications_table.php`](https://github.com/coollabsio/coolify/blob/940571e16f5a0e6c73cf56b4bb1184bed3d60623/database/migrations/2023_03_27_081716_create_applications_table.php) (`git_commit_sha` default)

**This repo:**
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — the `build`/`e2e` jobs to gate staging's deploy on
- [`compose.coolify.yaml`](../../compose.coolify.yaml) — the Compose resource shape production (and the planned staging resource) deploys under Coolify
