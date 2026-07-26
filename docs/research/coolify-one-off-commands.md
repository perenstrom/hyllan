# Research: Running one-off commands (DB migrations) against a Coolify-deployed service

**Scope:** Hyllan's current bare-VPS deployment (`docs/research/deployment-architecture.md`, `README.md` "Production deployment") runs `npm run db:migrate` by hand after `docker compose --profile production up -d --build`. The repo owner wants a second, parallel deploy path via **Coolify**, already installed on the target Hetzner VPS. This note researches, against Coolify's own official documentation (docs.coolify.io) and — where the docs were silent — Coolify's own source code (`github.com/coollabsio/coolify`, first-party), what mechanism(s) Coolify provides for running a one-off command (like a migration) against a deployed service, so the eventual Coolify deploy path can be designed around a real, documented feature rather than a guess.

No deployment config or scripts were changed for this ticket — research only.

---

## 1. Recommendations (summary)

| Question | Finding |
|---|---|
| Post-deployment hook? | Yes — **Pre/Post Deployment Commands**, but only documented for the **Dockerfile build pack** (and not for Nixpacks or Docker Compose). Runs `sh -c '<command>'` inside the freshly built container after deploy completes. |
| Exec into a running container? | Yes — Coolify's built-in **web Terminal** (browser, xterm.js, over WebSocket → SSH) works for "all containers or servers," but it is an interactive, manual, per-incident tool, not an automation hook. It can be globally disabled by an admin (which also blocks admins). |
| Distinct "one-off command" / "one-time task" resource type? | **No.** Coolify's deployable resource types are Applications, Databases, and Services (Compose-based stacks) — there is no separate "Job"/"one-off task" resource. The closest built-ins are (a) **Scheduled Tasks**, which are cron-based and container-scoped (confirmed in source: they literally shell out to `docker exec <container> sh -c '<command>'`), with a documented-by-behavior manual "Run Now" trigger; and (b) the Docker Compose build pack's `exclude_from_hc: true` flag, which the docs explicitly frame around "a one-time migration service" pattern. |
| Most robust way to run Hyllan's migrations on Coolify with minimal manual steps | Depends which build pack Hyllan uses on Coolify: **(A)** if `app` is deployed as its own Coolify "Application" resource with the **Dockerfile** build pack, set **Post-deployment Command** to `npm run db:migrate` — this runs automatically, in the new container, every deploy, with zero manual steps, per docs. **(B)** if the whole stack (`app`/`db`/`auth`/`proxy`) is deployed as one Coolify "Docker Compose" resource (closer to Hyllan's existing `compose.yaml`), Pre/Post-Deployment Commands are not documented for that build pack, so the documented equivalent is a dedicated one-shot `migrate` service in the compose file (`restart: "no"`, `exclude_from_hc: true`, running `npm run db:migrate` against `db`) that Coolify re-runs as part of every stack redeploy. Both are real, cited mechanisms below; neither requires the operator to manually run a command after each deploy the way the current bare-Compose instructions do. |

Detail and sourcing for each below.

---

## 2. Is there a documented "post-deployment command" hook?

Yes, but its documented scope is narrower than "any service" — it's a **Dockerfile build pack** feature.

Coolify's Dockerfile build pack docs describe an "Advanced Configuration" → "Pre/Post Deployment Commands" section:

- **Pre-deployment:** "Optionally, specify a script or command to execute in the existing container before" deployment begins.
- **Post-deployment:** "Optionally, specify a script or command to execute in the newly built container after" deployment completes.
- Both: "This command is run with `sh -c`, so you do not need to add it manually." ([Coolify Docs: Dockerfile Build Pack](https://coolify.io/docs/applications/build-packs/dockerfile))

Critically, this hook is **not** mentioned on the equivalent Advanced Configuration sections of the other build-pack docs:

- **Nixpacks build pack** — Advanced Configuration covers environment variables, Commands (install/build/start), the `nixpacks.toml`/`nixpacks.json` config file, and Node.js multi-core scaling. No Pre/Post Deployment Command section appears. ([Coolify Docs: Nixpacks Build Pack](https://coolify.io/docs/applications/build-packs/nixpacks))
- **Docker Compose build pack** — Advanced Configuration covers environment/shared variables, storage (bind mounts with `is_directory`/`content`), `exclude_from_hc`, networking (including an explicit warning against defining custom Compose networks), "Raw Compose Deployment" mode, labels, and build arguments. No Pre/Post Deployment Command section appears. ([Coolify Docs: Docker Compose Build Packs](https://coolify.io/docs/applications/build-packs/docker-compose))
- **Docker Image build pack** — no Advanced Configuration section discussing deployment commands at all. ([Coolify Docs: Docker Image Build Pack](https://coolify.io/docs/applications/build-packs/dockerimage))

**Read literally, this means**: the post-deployment hook is a first-class, automatic-on-every-deploy mechanism, but only for applications built from a Dockerfile (a single, well-defined "the container that just got built") — it isn't documented as available once an app is a multi-container Docker Compose stack, where "the container" is ambiguous across services.

---

## 3. Is there a way to exec into a running container's shell?

Yes — Coolify's built-in **Terminal**:

> "Coolify provides a built-in web terminal that offers seamless access to all your resources directly from your browser," available "for all resources managed by Coolify. Any containers or servers." ([Coolify Docs: Terminal](https://coolify.io/docs/knowledge-base/internal/terminal))

Architecture, per the same page: the browser opens a WebSocket connection requiring authentication; that connection is established inside Coolify's main Instance (host server) "to make sure that we have the permissions to access the resources"; a process inside the Coolify Instance container then "establishes a new SSH connection to the target resource (container or server)." The terminal UI itself is xterm.js. ([Coolify Docs: Terminal](https://coolify.io/docs/knowledge-base/internal/terminal))

This is exactly the shape needed to run `npm run db:migrate` by hand inside a deployed `app` container after a Coolify deploy — functionally equivalent to today's manual `docker compose exec app npm run db:migrate` step, just done through Coolify's UI instead of SSH. It is **not** an automation hook: nothing triggers it after a deploy; a human opens it and types the command.

Terminal access is also an all-or-nothing toggle at the server level:

> Disabling it affects "all terminals on the server and its containers," with "no per-container overrides possible," and "even root and admin users will be blocked." Only root/admin can change the setting (Coolify v4.0.0-beta.452+). ([Coolify Docs: Terminal Access](https://coolify.io/docs/knowledge-base/server/terminal-access))

There is also a separate `/knowledge-base/commands` doc page, but it documents commands for **administering the Coolify instance itself** (resetting the root password, changing the admin email, deleting a stuck service via `docker exec -ti coolify sh` against Coolify's *own* container) — not a general-purpose way to run commands in a deployed application's container. ([Coolify Docs: Commands](https://coolify.io/docs/knowledge-base/commands))

The Coolify public API does **not** currently expose a working "execute a command in an application's container" endpoint. The documented operation path would be `POST /api/v1/applications/{uuid}/execute`, and third-party reports describe it 404ing. Checking Coolify's own source directly (`main` branch, `routes/api.php`, fetched during this research) confirms there is currently **no** `/applications/{uuid}/execute` route registered at all — only start/restart/stop actions exist for applications (`action_deploy`, `action_restart`, `action_stop`). So today, there is no API-level equivalent of "exec a command"; automating a post-deploy command via the API isn't a documented, working option. ([github.com/coollabsio/coolify: `routes/api.php`](https://github.com/coollabsio/coolify/blob/main/routes/api.php))

---

## 4. Is there a distinct "one-off command" / "one-time task" resource type?

**No.** Coolify's resource model (per the docs' own navigation/structure) is Applications, Databases, and Services (Compose-based stacks) plus supporting concepts (Scheduled Tasks, Backups). There is no separate deployable "Job" or "one-time task" resource analogous to, say, a Kubernetes `Job`.

The two closest built-in mechanisms:

**a) Scheduled Tasks.** Documented cron syntax (standard 5-field `* * * * *`, plus shorthand strings `hourly`/`daily`/`weekly`/`monthly`/`yearly`, with or without an `@` prefix) is described on its own page: ([Coolify Docs: Supported Cron Syntax](https://coolify.io/docs/knowledge-base/cron-syntax)) That page documents only the cron *syntax*, not the execution model or resource type it attaches to — Coolify's docs don't have a dedicated conceptual page for "Scheduled Tasks" beyond this. To confirm how they actually run, this research went to Coolify's own source code (first-party, `main` branch at time of writing):

- `app/Models/ScheduledTask.php` shows a `ScheduledTask` belongs to either an `Application` or a `Service`, and has `command`, `frequency`, `container`, and `timeout` fields. ([github.com/coollabsio/coolify: `app/Models/ScheduledTask.php`](https://github.com/coollabsio/coolify/blob/main/app/Models/ScheduledTask.php))
- `app/Jobs/ScheduledTaskJob.php` shows the actual execution: it looks up the resource's currently running container(s), and for the matched container builds and runs `docker exec {$containerName} sh -c '<command>'` on the target server (via `instant_remote_process`, i.e. over SSH to the host). If more than one container is running for a resource and no specific container is configured, the job throws rather than guessing. ([github.com/coollabsio/coolify: `app/Jobs/ScheduledTaskJob.php`, line ~150](https://github.com/coollabsio/coolify/blob/main/app/Jobs/ScheduledTaskJob.php))

So a "Scheduled Task" is really "run this shell command via `docker exec` against this application/service's container, on a cron schedule" — it is fundamentally a recurring-schedule primitive, not a deploy-triggered one. Community reports (GitHub issue tracker, not docs, so not load-bearing here) describe a "Run Now" manual-trigger affordance in the dashboard for a configured Scheduled Task, which would let an operator manually kick a migration task on demand after a deploy — but that is still a manual step, and nothing in the docs ties a Scheduled Task's execution to a deploy event.

**b) `exclude_from_hc` for a one-time Compose service.** The Docker Compose build pack docs explicitly name this exact use case:

> "If a service should not be part of the overall healthchecks (for example, a one-time migration service), set the `exclude_from_hc` option to `true`":
> ```yaml
> services:
>   some-service:
>     exclude_from_hc: true
> ```
> ([Coolify Docs: Docker Compose Build Packs](https://coolify.io/docs/applications/build-packs/docker-compose))

This is Coolify's own documented pattern-name for "a one-time migration service" living inside a Compose stack — it isn't a distinct resource type, but it is the officially-acknowledged shape for exactly Hyllan's use case, expressed as a normal Compose service Coolify already knows how to run every time it applies the stack.

---

## 5. Given what's documented, what's the most robust way to run Hyllan's migrations automatically on Coolify?

This comes down to which Coolify build pack Hyllan's `app` ends up under, since that's what determines which of the two documented mechanisms (§2, §4b) is actually available. Both are legitimate, both are documented, and the choice is really about how much of the existing `compose.yaml` topology (`app`/`db`/`auth`/`proxy`/`backup`) migrates as-is into Coolify's model vs. gets re-expressed as separate Coolify-native resources.

**Option A — `app` becomes its own Coolify "Application" resource, Dockerfile build pack.** This fits if Postgres/GoTrue move to Coolify's native Database/Service resources instead of living in the same Compose file as `app`. Then:

- Set **Post-deployment Command** (Advanced Configuration) to `npm run db:migrate`. Per docs, this runs, with `sh -c`, "in the newly built container after deployment completes" — i.e. automatically, on every deploy, in the exact container that's about to serve traffic, no manual step at all. ([Coolify Docs: Dockerfile Build Pack](https://coolify.io/docs/applications/build-packs/dockerfile))
- This is the closest Coolify equivalent to "CI/CD post-deploy migration hook" patterns from other PaaS's, and it's the only one of the two options that's actually a deploy-triggered hook rather than a cron/redeploy-time side effect.
- Caveat worth flagging: the docs don't specify command ordering relative to health checks / traffic cutover (e.g. whether the post-deployment command must succeed before Coolify routes traffic to the new container) — that's not stated on the page and would need to be verified empirically before relying on it in production.

**Option B — the whole stack stays one Coolify "Docker Compose" resource**, closer to today's `compose.yaml`. Pre/Post Deployment Commands aren't documented for this build pack (§2), so the equivalent, documented mechanism is adding a dedicated one-shot service to the compose file, e.g.:

```yaml
services:
  migrate:
    build: .            # same image as `app`
    command: ["npm", "run", "db:migrate"]
    restart: "no"
    exclude_from_hc: true
    depends_on:
      db:
        condition: service_healthy
```

Because Coolify (re-)applies the Compose file on every deploy of that resource, this `migrate` service runs, does its job, and exits, on every deploy — without manual intervention — and `exclude_from_hc: true` keeps its (expected, healthy) exit from being misread as a failed/unhealthy stack the way a persistent-service healthcheck model normally would. This is explicitly the pattern the docs name ("a one-time migration service"). The gap here (not covered by the fetched docs) is whether Coolify's Compose redeploy always re-runs a `restart: "no"` service that already ran to completion, or might skip it if the container still exists in an "Exited (0)" state — that operational detail isn't addressed in the docs excerpts found and should be validated against the actual Coolify version in use before depending on it.

**Either way**, both options are strictly less manual than the current bare-Compose instructions (`docker compose ... up -d --build` followed by a by-hand `npm run db:migrate`) — the operator's only remaining manual step in the worst case is opening Coolify's Terminal (§3) if a hook is misconfigured or a one-off manual re-run is ever needed, which is also a real, documented fallback, just not an automated one.

---

## Sources

- [Coolify Docs: Dockerfile Build Pack](https://coolify.io/docs/applications/build-packs/dockerfile) — Pre/Post Deployment Commands
- [Coolify Docs: Nixpacks Build Pack](https://coolify.io/docs/applications/build-packs/nixpacks) — Advanced Configuration (no deployment-command hook)
- [Coolify Docs: Docker Compose Build Packs](https://coolify.io/docs/applications/build-packs/docker-compose) — `exclude_from_hc`, networking, Raw Compose Deployment
- [Coolify Docs: Docker Image Build Pack](https://coolify.io/docs/applications/build-packs/dockerimage)
- [Coolify Docs: Applications (overview)](https://coolify.io/docs/applications)
- [Coolify Docs: Terminal](https://coolify.io/docs/knowledge-base/internal/terminal)
- [Coolify Docs: Terminal Access](https://coolify.io/docs/knowledge-base/server/terminal-access)
- [Coolify Docs: Commands](https://coolify.io/docs/knowledge-base/commands) — Coolify-instance-level admin commands, not app-container commands
- [Coolify Docs: Supported Cron Syntax](https://coolify.io/docs/knowledge-base/cron-syntax)
- [github.com/coollabsio/coolify: `routes/api.php`](https://github.com/coollabsio/coolify/blob/main/routes/api.php) — confirms no `/applications/{uuid}/execute` API route currently registered
- [github.com/coollabsio/coolify: `app/Models/ScheduledTask.php`](https://github.com/coollabsio/coolify/blob/main/app/Models/ScheduledTask.php)
- [github.com/coollabsio/coolify: `app/Jobs/ScheduledTaskJob.php`](https://github.com/coollabsio/coolify/blob/main/app/Jobs/ScheduledTaskJob.php) — confirms Scheduled Tasks execute via `docker exec <container> sh -c '<command>'`

**Ticket:** [PER-241 — Running one-off commands (DB migrations) against a Coolify-deployed service](https://linear.app/per-enstrom/issue/PER-241)
