# Issue tracker: Linear

Issues and specs (PRDs) for this repo are tracked in Linear, in the **hyllan** project (`/per-enstrom/project/hyllan-5b8a73c0069f/`).

## Conventions

- **Create an issue**: use the connected Linear MCP tools (e.g. `mcp__linear__create_issue` or equivalent) to create the issue in the `hyllan` project. Include a clear title and a full description/body.
- **Read an issue**: fetch it via the Linear MCP tools by issue ID or URL.
- **List issues**: query the Linear MCP tools, scoped to the `hyllan` project, filtering by label/state as needed.
- **Comment on an issue**: use the Linear MCP tools' comment-creation call.
- **Apply / remove labels**: use the Linear MCP tools' label-update call.
- **Close / change state**: use the Linear MCP tools' state-update call (Linear uses workflow states rather than a simple open/closed flag — pick the state that matches "closed" for this workflow, e.g. Done/Canceled).

If no Linear MCP server is connected in the current session, don't guess at an API call — tell the user what issue/comment/label change you'd make and ask them to apply it in Linear themselves.

## When a skill says "publish to the issue tracker"

Create a new issue in the `hyllan` Linear project via the Linear MCP tools.

## When a skill says "fetch the relevant ticket"

Fetch the issue from Linear via the Linear MCP tools, using the ID or URL the user provided.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a Linear issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a Linear sub-issue of the map, labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, assign it to the driving dev.
- **Blocking**: Linear's native issue relations (`blocks` / `blocked by`). A ticket is unblocked when every blocker is in a closed state.
- **Frontier query**: list the map's open sub-issues, drop any with an open blocking relation or an assignee; first in map order wins.
- **Claim**: assign the issue to yourself — the session's first write.
- **Resolve**: comment with the answer, move the issue to a closed state, then append a context pointer (gist + link) to the map's Decisions-so-far.
