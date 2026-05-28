# Agent Workflow Notes

This directory is a nested Git repository for the TypeScript web client. It is managed separately from the root launcher repo.

- Target remote branch: `origin/webclient-254`
- Fork remote: `https://github.com/aelder202/Server.git`
- Upstream reference: `https://github.com/LostCityRS/Client-TS`

Before editing, run `git pull` from this directory and check `git status --short`. Some older local workspaces may show the local branch as `254`, but it should track `origin/webclient-254`.

Commit webclient source changes from this directory, not from the root repo. Do not commit `node_modules/` or `out/`.

After changing client source, build the client:

```powershell
bun run build
```

If the server should immediately serve the new client bundle, copy the output into the engine repo and commit that file there too:

```powershell
Copy-Item -Path out\client.js -Destination ..\engine\public\client\client.js -Force
```
