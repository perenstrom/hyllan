# Research: What does a HACS-compliant custom Home Assistant integration actually require?

**Ticket:** [PER-318 — HACS integration project scaffolding requirements](https://linear.app/per-enstrom/issue/PER-318) (child of the wayfinder map [PER-312, "Home Assistant integration for Hyllan"](https://linear.app/per-enstrom/issue/PER-312))

**Scope:** Pure fact-finding against primary sources — Home Assistant's own developer docs (`developers.home-assistant.io`), HACS's own docs (`hacs.xyz`), and the `home-assistant/brands` repository — on six sub-questions: repo/directory layout, `manifest.json`/`hacs.json` contents, the Brands submission process, HACS versioning/release conventions, bundling a Lovelace card alongside a Python integration in one repo, and whether a HACS integration can live in an unrelated monorepo. No design recommendation is made here — this is groundwork for the wayfinder map's "where does this code live" fog item.

**A note on access:** `developers.home-assistant.io` and `www.hacs.xyz` are both blocked by this environment's network egress proxy. Both projects publish the exact Markdown that renders to those sites in their own GitHub source repositories (`home-assistant/developers.home-assistant`, docs in `docs/`; `hacs/documentation`, docs in `source/docs/`), which is what every citation below points to instead — same content, source of truth rather than the rendered site. `home-assistant/brands`' own `README.md` was fetched directly since it isn't blocked.

---

## Summary of findings

| # | Question | Finding |
|---|---|---|
| 1 | Repo layout | `custom_components/<domain>/` at the **root** of the repo, `manifest.json` + `__init__.py` minimum. `hacs.json` and `README.md` also at repo root. |
| 2 | `manifest.json` / `hacs.json` | HA itself requires `domain`, `name`, `codeowners`, `dependencies`, `documentation`, `integration_type`, `iot_class`, `requirements`, plus `version` (custom-integration-only, SemVer/CalVer via AwesomeVersion). HACS additionally *requires* `issue_tracker` in the same file. `hacs.json` needs at minimum `name`. |
| 3 | Brands repo | **Not required at all, as of HA 2026.3.0.** A custom integration can bundle its own `brand/` directory (with `icon.png` etc.) directly inside `custom_components/<domain>/brand/`, and HA serves it locally, taking precedence over the central `home-assistant/brands` repo. Before 2026.3 this was mandatory. |
| 4 | Versioning/releases | HACS reads the **GitHub Release tag name** as the version. Tags without a Release are ignored ("just publishing tags is not enough"); no release at all falls back to the default branch. `manifest.json`'s `version` must independently be AwesomeVersion-parseable (SemVer or CalVer). |
| 5 | Card + integration, one repo? | HACS has separate repository **categories** (`integration`, `plugin`/"dashboard", `theme`, etc.), each with its own directory-structure rule, and a repository is validated/listed under exactly **one** category at a time. There's no combined "integration+plugin" category; a repo can technically hold both an `custom_components/` tree and `dist/*.js`, but HACS itself will only track/version it under whichever single category it's added as. The common real-world pattern for bundling a card with an integration is for the **integration's own Python code** to register the frontend resource with Home Assistant at startup, bypassing HACS's plugin mechanism entirely. |
| 6 | Monorepo vs. standalone repo | HACS's docs describe no subdirectory/monorepo option. `hacs.json` "must be located in the root of your repository," and the integration category's structure rule is defined purely in terms of `ROOT_OF_THE_REPO/custom_components/...` — every "OK"/"not OK" example in the docs is a whole-repository layout, not a subtree. There is no documented mechanism to point a HACS repository entry at a subdirectory of a larger repo. This supports treating the HACS integration as needing its own repository, separate from Hyllan's Next.js app repo. |

Detail and sourcing for each below.

---

## 1. Repo/directory layout HACS expects

Home Assistant's own file-structure doc states the bare-minimum contents of an integration's directory: a `manifest.json` and an `__init__.py` (which "can be limited to a docstring introducing the integration" if the integration only offers a platform). The directory is named after the integration's `domain`, and HA looks for it at `<config directory>/custom_components/<domain>` (or `homeassistant/components/<domain>` for built-in integrations). Additional files are added as needed: `light.py`/`switch.py`/etc. for entity platforms, `services.yaml` for service actions, `coordinator.py` for a `DataUpdateCoordinator`, and a `brand/` directory for locally-bundled brand images (see §3). (Home Assistant Developer Docs — [Integration file structure](https://developers.home-assistant.io/docs/creating_integration_file_structure/); source: [`home-assistant/developers.home-assistant` — `docs/creating_integration_file_structure.md`](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/creating_integration_file_structure.md))

HACS layers a **repository-level** structure requirement on top of that. Per HACS's own "Integrations" publishing doc, quoted directly:

> - There must only be one integration per repository, i.e. there can only be one subdirectory to `ROOT_OF_THE_REPO/custom_components/`. *If there are more than one, only the first one will be managed.*
> - All files required for the integration to run must be located inside the directory `ROOT_OF_THE_REPO/custom_components/INTEGRATION_NAME/`.

The doc's "OK" example is:

```
custom_components/awesome/__init__.py
custom_components/awesome/sensor.py
custom_components/awesome/manifest.json
README.md
hacs.json
```

— i.e. `custom_components/<domain>/` **and** `hacs.json` **and** `README.md` all live at the repository root, side by side. Two explicit "not OK" examples are given: no `custom_components/` wrapper at all (files directly under a top-level folder named after the integration, or directly in the repo root) — unless `content_in_root: true` is set in `hacs.json`, which opts an integration out of the `custom_components/` nesting requirement entirely. (HACS Docs — [Integrations](https://hacs.xyz/docs/publish/integration/); source: [`hacs/documentation` — `source/docs/publish/integration.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/integration.md))

`hacs.json` itself "must be located in the root of your repository" — this is stated as a hard rule in HACS's general publishing requirements, not a per-category option. (HACS Docs — [General](https://hacs.xyz/docs/publish/start/); source: [`hacs/documentation` — `source/docs/publish/start.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/start.md))

**Bottom line:** the expected shape is `<repo root>/custom_components/<domain>/{__init__.py, manifest.json, ...}` plus `<repo root>/{hacs.json, README.md}` — a self-contained repository whose root *is* the integration.

---

## 2. `manifest.json` and `hacs.json` contents

### `manifest.json` (Home Assistant's own requirements)

Every integration requires a `manifest.json`. Home Assistant's manifest doc lists these keys and their meaning:

- **`domain`** — "a short name consisting of characters and underscores," unique, must match the directory name.
- **`name`** — display name; naming rules apply for cloud-vs-local variants (e.g. append "Cloud" only for a cloud-specific variant).
- **`version`** — **"omitted" for core integrations**, but **"required for custom integrations,"** and "needs to be a valid version recognized by AwesomeVersion like CalVer or SemVer."
- **`integration_type`** — one of `device`, `entity`, `hardware`, `helper`, `hub`, `service`, `system`, `virtual`; required for core integrations with a config flow, defaults to `hub` for custom/YAML-based integrations if omitted (but setting it explicitly is recommended).
- **`documentation`** — URL to usage docs.
- **`issue_tracker`** — URL for bug reports; "omitted" for integrations submitted to HA Core itself (HA auto-generates the link for built-ins).
- **`dependencies`** / **`after_dependencies`** — other HA integrations to load before/around this one; custom integrations may depend on both built-in and other custom integrations.
- **`codeowners`** — GitHub usernames/teams responsible for the integration.
- **`config_flow`** — boolean; when set, `config_flow.py` must exist in the integration.
- **`single_config_entry`** — boolean; restricts the integration to one config entry.
- **`requirements`** — array of pip-installable strings (custom integrations should only list packages not already in HA Core's own `requirements.txt`).
- **`loggers`**, **`quality_scale`** (`bronze`/`silver`/`gold`/`platinum`), and discovery matchers (`bluetooth`, `zeroconf`, `ssdp`, `homekit`, `mqtt`, `dhcp`, `usb`) — all optional.
- **`iot_class`** — one of `assumed_state`, `cloud_polling`, `cloud_push`, `local_polling`, `local_push`, `calculated`.

A minimal example given in the docs:

```json
{
  "domain": "your_domain_name",
  "name": "Your Integration",
  "codeowners": [],
  "dependencies": [],
  "documentation": "https://www.example.com",
  "integration_type": "hub",
  "iot_class": "cloud_polling",
  "requirements": []
}
```

(Home Assistant Developer Docs — [Integration manifest](https://developers.home-assistant.io/docs/creating_integration_manifest/); source: [`home-assistant/developers.home-assistant` — `docs/creating_integration_manifest.md`](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/creating_integration_manifest.md))

### `manifest.json` (HACS's *additional* requirement)

HACS's own integration-publishing doc requires the manifest to "at least define" `domain`, `documentation`, `issue_tracker`, `codeowners`, `name`, and `version` — i.e. HACS explicitly requires **`issue_tracker`** to be present, even though HA's own docs say that field should be *omitted* for integrations submitted to HA Core (it only applies to standalone custom integrations, which is exactly HACS's use case, so the two docs aren't actually in conflict — just scoped to different distribution paths). (HACS Docs — [Integrations](https://hacs.xyz/docs/publish/integration/); same source as §1)

### `hacs.json` (repo root)

Required key: **`name`** (string) — the display name HACS shows in its UI. Everything else is optional:

| Key | Type | Purpose |
|---|---|---|
| `content_in_root` | bool | content lives at repo root instead of a subdirectory |
| `zip_release` | bool | content ships as a zip archive attached to a GitHub Release (integrations only; requires `filename`) |
| `filename` | string | the file HACS should look for (single-item types: plugin/theme/template/python_script/zip_release) |
| `hide_default_branch` | bool | don't offer the default branch as a download option |
| `country` | string/array | ISO 3166-1 alpha-2 country restriction |
| `homeassistant` | string | minimum required HA version |
| `hacs` | string | minimum required HACS version |
| `persistent_directory` | string | a path (relative to the integration dir) preserved across upgrades — integrations only |

Example:

```json
{
  "name": "My awesome thing",
  "content_in_root": true,
  "filename": "my_super_awesome_thing.js",
  "country": ["NO", "SE", "DK"]
}
```

(HACS Docs — [General](https://hacs.xyz/docs/publish/start/); same source as §1)

---

## 3. The Brands repo submission process — and whether it's actually required

`home-assistant/brands`' own README describes it as a centralized repository that "holds the icons and logos for all the brands Home Assistant supports," generating a static site served at `https://brands.home-assistant.io/...`. It has two relevant top-level folders: `core_integrations/` (bundled-with-Core integrations) and **`custom_integrations/`** (custom components) — explicitly labeled **"Legacy folder"** in the current README, with a pointer to the "Brands Proxy API announcement" for why. Each domain folder needs up to eight PNG files (`icon.png` 256×256 + `icon@2x.png` 512×512, optional `dark_` variants, plus landscape `logo.png`/`logo@2x.png`), all square/1:1 for icons, PNG, trimmed, transparency preferred. Submission is a pull request against the repo, with the domain folder name matching `manifest.json`'s `domain` exactly. (`home-assistant/brands` — [`README.md`](https://github.com/home-assistant/brands/blob/master/README.md))

**The pivotal, and somewhat surprising, finding:** Home Assistant's own "Brand images" developer doc states plainly that this submission process is **no longer required** for custom integrations:

> Before Home Assistant 2026.3, custom integrations were also required to add their brand images to the [brands repository]. Starting with Home Assistant 2026.3, custom integrations can include their own brand images by adding a `brand/` directory inside the integration directory. For example, if you have a custom integration with the domain `my_integration`, you can add brand images in `custom_components/my_integration/brand/`.
>
> Local brand images take precedence over images from the [brands repository], so if a custom integration has a local `brand/` directory, Home Assistant will use those images instead of the ones from the [brands repository].

Serving is handled by a local, authenticated API (`/api/brands/integration/{domain}/{image}`), with a generic placeholder returned by default for anything missing. (Home Assistant Developer Docs — [Brand images](https://developers.home-assistant.io/docs/core/integration/brand_images/); source: [`home-assistant/developers.home-assistant` — `docs/core/integration/brand_images.md`](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/core/integration/brand_images.md))

Since today (2026-09-11) is after that 2026.3 cutover, a custom integration can ship with a working icon/logo in the HA UI purely by including `custom_components/<domain>/brand/{icon.png,...}` in its own repo — **zero external PR, zero `home-assistant/brands` dependency, zero review-queue wait.** The only reason to still use the central repo is if the integration is later contributed into HA Core itself, at which point the doc explicitly says to move the images there and delete the local copy.

**Interaction with HACS:** HACS's own inclusion-review checklist (for repos submitted to `hacs/default`, not for a private custom-repository add) runs a "Check brands" step that "Checks that your integration has a brand directory with at least an `icon.png` file. If it doesn't, it falls back to checking the domain in the [home-assistant/brands] repository" — i.e. HACS's own validation already treats the local `brand/` directory as the primary, preferred path and the central repo as the fallback, consistent with HA's current stance. (HACS Docs — [Include default repositories](https://hacs.xyz/docs/publish/include/); source: [`hacs/documentation` — `source/docs/publish/include.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/include.md))

---

## 4. Versioning and release conventions HACS expects

From HACS's general publishing requirements, quoted directly:

> If the repository uses GitHub releases, the tag name from the latest release is used to set the remote version. *Just publishing tags is not enough, you need to publish releases.*
>
> If the repository does not use tags, the 7 first characters of the last commit will be used.

For the **integration** category specifically, GitHub releases are explicitly "optional" for a repo to work as a *custom* (user-added) repository — "if you don't publish releases in your repository, HACS will use the files in the branch marked as default" — but publishing them is described as "preferred," since it gives users a picker between the 5 latest releases and the default branch when installing/upgrading. For **submission to `hacs/default`** (the curated store), a release is mandatory: "Create a new GitHub release (not just a tag, a full release) after the actions run successfully" is listed as a prerequisite, and one of the automated review checks is explicitly "Check releases — Checks that your repository has at least one release." (HACS Docs — [General](https://hacs.xyz/docs/publish/start/) and [Integrations](https://hacs.xyz/docs/publish/integration/) and [Include default repositories](https://hacs.xyz/docs/publish/include/); sources as above)

Version *strings* (both the release tag and `manifest.json`'s own `version` field) must be parseable by the `AwesomeVersion` library — SemVer or CalVer both work, and HACS's docs point to the [AwesomeVersion demo](https://awesomeversion.ludeeus.dev/) as the same library both HACS and Home Assistant use for version comparisons. HA's own manifest doc states the identical constraint independently for `version` (§2 above).

**Bottom line:** tag *and* publish a GitHub Release (not just a git tag) for every version; name the tag a SemVer or CalVer string HACS/HA can parse; releases are optional for a plain custom-repository add but required for the curated default store.

---

## 5. Bundling a Lovelace card with the integration in one HACS repo

HACS repositories are classified into a fixed set of **categories**, each with its own directory-structure rule and its own review checklist. The categories named across HACS's docs are: `integration`, `plugin` (user-facing label: "Dashboard" — the doc notes "plugin" is legacy internal naming, previously also called "Lovelace"), `theme`, `template`, `python_script`, and `appdaemon`. The GitHub Action HACS ships for repo-owner CI validation takes a single `category` input restricted to exactly this enum, and `hacs/default` — the curated list HACS reads from — stores memberships in one file per category (`./integration`, `./plugin`, `./theme`, etc.). When a user manually adds a "Custom repository" in the HACS UI, they likewise "select the correct type" — one type per repository entry. (HACS Docs — [GitHub Action](https://hacs.xyz/docs/publish/action/), [Include default repositories](https://hacs.xyz/docs/publish/include/), [Custom Repositories (FAQ)](https://hacs.xyz/docs/faq/custom_repositories/), [Repository types](https://hacs.xyz/docs/use/repositories/type/); sources: [`hacs/documentation` — `source/docs/publish/action.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/action.md), [`.../publish/include.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/include.md), [`.../faq/custom_repositories.md`](https://github.com/hacs/documentation/blob/main/source/docs/faq/custom_repositories.md))

The **`integration`** category's structure rule is the `custom_components/<domain>/` layout from §1. The **`plugin`**/Dashboard category's rule is entirely different: HACS looks for `.js` files under `ROOT_OF_THE_REPO/dist/` (checked first), then in the latest GitHub Release, then the repository root — with the located file expected to share the repo's name (or, for repos prefixed `lovelace-`, the name with that prefix stripped). (HACS Docs — [Plugin (Dashboard)](https://hacs.xyz/docs/publish/plugin/); source: [`hacs/documentation` — `source/docs/publish/plugin.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/plugin.md))

**So: is a combined "integration + plugin" HACS listing supported?** No — HACS's own docs describe categories as a per-repository-entry, single-value classification (the Action's `category` input, `hacs/default`'s per-category files, and the "select the correct type" UI step all agree on this), not a repo-level property that can hold two values. Nothing in HACS's documentation describes a repository being simultaneously tracked/versioned under two categories from one listing. Getting a card *and* an integration both into HACS from a shared codebase would mean **two separate HACS repository entries** — either two GitHub repos, or (structurally, since HACS's directory checks for the two categories don't actually collide — `custom_components/<domain>/` and `dist/*.js` can coexist at the same repo root) potentially the same GitHub repo added to HACS twice, once as `integration` and once as `plugin`. HACS's docs do not explicitly confirm or rule out that latter "same repo, two listings" case; it isn't a scenario any of the pages fetched addresses directly.

**What integrations actually do in practice, per source inspection:** a well-known real-world example, `thomasloven/hass-browser_mod` (a popular HACS-distributed integration that also ships a substantial custom-card frontend), keeps both `custom_components/browser_mod/` (the Python integration) and a `js/` source tree (compiled via Rollup) in one repository, with a single `hacs.json` containing no category marker — i.e. it's registered with HACS as one `integration` listing, and its `hacs.json` has no `plugin`/`dist` structure for HACS to track separately. The frontend resource is registered with Home Assistant's frontend at integration-setup time by the integration's own Python code (via HA's static-file/`extra_module_url` registration APIs), not delivered as a HACS-managed Lovelace resource. This confirms the practical answer implied by the categories doc: **bundling a card with an integration in one repo is a real, common pattern, but the card is not distributed through HACS's `plugin` mechanism in that case — the integration's own backend code is what wires the frontend asset into Home Assistant.** (Repository inspection: [`thomasloven/hass-browser_mod`](https://github.com/thomasloven/hass-browser_mod), `hacs.json` at repo root)

---

## 6. Same monorepo as the Next.js app, or a standalone repo?

Nothing in HACS's documentation describes pointing a HACS repository entry at a subdirectory of a larger repository. Every structural rule found is phrased in terms of the **whole repository root**:

- `hacs.json` "must be located in the root of your repository" (§1, [General](https://hacs.xyz/docs/publish/start/)).
- The integration category's "OK"/"not OK" examples in §1 are complete repository listings — `custom_components/<domain>/`, `hacs.json`, and `README.md` are all shown as siblings at the top level, and the doc's only escape hatch (`content_in_root`) changes *where inside the repo* the integration's own files sit relative to the `custom_components/` wrapper — it does not offer a path/prefix option to point at an arbitrary subdirectory of a bigger repository.
- The plugin category's file search (`dist/` → latest release → repo root) is likewise rooted at `ROOT_OF_THE_REPO`.
- `hacs.json`'s documented key list (§2) has no `path`, `subdirectory`, or equivalent field for narrowing HACS's scan to part of a repository.

So while HACS's only hard *platform* requirement stated up front is "Only public repositories on GitHub will work with HACS" ([General](https://hacs.xyz/docs/publish/start/)) — nothing about the repo needing to be dedicated to Home Assistant *content* as a formal rule — every concrete structural check (`hacs.json` location, `custom_components/` location, plugin file search paths) is anchored to the repository root with no documented way to redirect that anchor into a subtree. Embedding the integration under, say, `hyllan/ha-integration/custom_components/hyllan/...` inside this monorepo would put `hacs.json` and `custom_components/` at the wrong level for every check HACS's docs describe — there is no config knob to tell HACS "look under `ha-integration/` instead of the repo root."

**Practical implication:** treating this monorepo's assumption as verified rather than merely likely — HACS's docs describe no supported way to add "this app's repo, but only this subfolder" as a HACS repository. The wayfinder map's fog item is resolved in favor of **a standalone GitHub repository** dedicated to the HA integration (and, per §5, a decision on whether any bundled card ships via a second such repo/listing or via the integration's own backend-registered frontend resource).

---

## Open questions for a later design session

- Whether the "same repo, added to HACS twice under two categories" option in §5 is actually accepted by HACS in practice — the docs don't explicitly confirm or forbid it, unlike everything else in this note, which is directly stated.
- Whether HACS's brand-asset check (§3) is enforced only during `hacs/default` inclusion review, or also blocks/warns on a plain "Add custom repository" action — the "Requirements" wording on the integration page doesn't distinguish the two paths explicitly.
- If Hyllan's HA integration is meant to talk to Hyllan's own API, whether it should target the curated `hacs/default` store (review queue "takes months," per HACS's own docs) or ship purely as a user-added custom repository, which has none of the default-store review requirements (release, brand check, GitHub Action, etc.) beyond HACS's baseline structural rules.

---

## Sources

**Home Assistant Developer Docs** (`home-assistant/developers.home-assistant`, branch `master`):
- [Integration file structure](https://developers.home-assistant.io/docs/creating_integration_file_structure/) / source: [`docs/creating_integration_file_structure.md`](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/creating_integration_file_structure.md)
- [Integration manifest](https://developers.home-assistant.io/docs/creating_integration_manifest/) / source: [`docs/creating_integration_manifest.md`](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/creating_integration_manifest.md)
- [Brand images](https://developers.home-assistant.io/docs/core/integration/brand_images/) / source: [`docs/core/integration/brand_images.md`](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/core/integration/brand_images.md)

**HACS Docs** (`hacs/documentation`, branch `main`):
- [General](https://hacs.xyz/docs/publish/start/) / source: [`source/docs/publish/start.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/start.md)
- [Integrations](https://hacs.xyz/docs/publish/integration/) / source: [`source/docs/publish/integration.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/integration.md)
- [Plugin (Dashboard)](https://hacs.xyz/docs/publish/plugin/) / source: [`source/docs/publish/plugin.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/plugin.md)
- [GitHub Action](https://hacs.xyz/docs/publish/action/) / source: [`source/docs/publish/action.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/action.md)
- [Include default repositories](https://hacs.xyz/docs/publish/include/) / source: [`source/docs/publish/include.md`](https://github.com/hacs/documentation/blob/main/source/docs/publish/include.md)
- [Custom Repositories (FAQ)](https://hacs.xyz/docs/faq/custom_repositories/) / source: [`source/docs/faq/custom_repositories.md`](https://github.com/hacs/documentation/blob/main/source/docs/faq/custom_repositories.md)
- [Repository types](https://hacs.xyz/docs/use/repositories/type/) and [Dashboard](https://hacs.xyz/docs/use/repositories/type/dashboard/) / sources: [`source/docs/use/repositories/type/index.md`](https://github.com/hacs/documentation/blob/main/source/docs/use/repositories/type/index.md), [`.../dashboard.md`](https://github.com/hacs/documentation/blob/main/source/docs/use/repositories/type/dashboard.md)

**`home-assistant/brands`** (branch `master`):
- [`README.md`](https://github.com/home-assistant/brands/blob/master/README.md)

**Real-world reference (repo inspection, not a secondary write-up):**
- [`thomasloven/hass-browser_mod`](https://github.com/thomasloven/hass-browser_mod) — combined integration + frontend-card repository, `hacs.json` at root

**This repo (context only):**
- `CLAUDE.md`, `docs/agents/issue-tracker.md` — wayfinder/research conventions
- `docs/research/mcp-oauth-gotrue.md`, `docs/research/mcp-sdk-nextjs-transport.md` — structural model for this note
