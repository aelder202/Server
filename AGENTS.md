# Agent Workflow Notes

This directory is a nested Git repository for server code. It is managed separately from the root launcher repo.

- Target remote branch: `origin/engine-254`
- Fork remote: `https://github.com/aelder202/Server.git`
- Upstream reference: `https://github.com/LostCityRS/Engine-TS`

Before editing, run `git pull` from this directory and check `git status --short`. Some older local workspaces may show the local branch as `254`, but it should track `origin/engine-254`.

Commit server changes from this directory, not from the root repo. Generated/runtime files such as `.env`, `db.sqlite`, `data/pack/`, `data/players/`, `data/living-world/`, `node_modules/`, and client source maps should remain ignored.

If webclient source changes need to be served by the server, run `bun run build` in `../webclient`, copy `../webclient/out/client.js` to `public/client/client.js`, and commit that refreshed bundle here.

Useful checks:

```powershell
git status --short
bun run build
```
