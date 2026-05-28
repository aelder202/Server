# Agent Workflow Notes

This is a launcher repository that manages several nested Git repositories. It is not a normal monorepo and it does not use Git submodules.

## Repository Layout

- Root repository: `https://github.com/aelder202/Server.git`, branch `main`.
- `engine/`: nested Git repository for server code. In this forked setup it is cloned from `https://github.com/aelder202/Server.git`, branch `engine-254`.
- `webclient/`: nested Git repository for TypeScript client code. In this forked setup it is cloned from `https://github.com/aelder202/Server.git`, branch `webclient-254`.
- `content/`: nested upstream LostCityRS content repository for revision `254`.
- `javaclient/`: nested upstream LostCityRS Java client repository for revision `254`.

`server.json` is tracked intentionally. It tells `start.js` which nested repository URL and branch to clone for modified components. Do not re-ignore `server.json`.

## Fresh Machine Setup

From a new PC:

```powershell
git clone https://github.com/aelder202/Server.git LostCity
cd LostCity
.\start.bat
```

The first run clones the nested repositories using `server.json`. A fresh clone should run the modified game because `engine` and `webclient` come from this fork's modified branches.

## Pulling Updates

Before making changes, update each relevant repository:

```powershell
git pull
git -C engine pull
git -C webclient pull
```

The launcher menu's `Update Source` option also runs `git pull` inside the nested repos. On existing machines, verify branches with:

```powershell
git branch -vv
git -C engine branch -vv
git -C webclient branch -vv
```

Local branch names may differ on old workspaces, but engine changes must push to `origin/engine-254` and webclient changes must push to `origin/webclient-254`.

## Where To Commit

- Root launcher/config changes (`start.js`, `server.json`, root `.gitignore`, `start.bat`, `README.md`, this file): commit from the root repo and push to `main`.
- Server changes under `engine/`: commit from inside `engine/` and push to `origin/engine-254`.
- Web client changes under `webclient/`: commit from inside `webclient/` and push to `origin/webclient-254`.
- Avoid flattening `engine/`, `webclient/`, `content/`, or `javaclient/` into the root repo. They are intentionally ignored at the root level because they are nested Git repositories.

## Web Client Build Coupling

When changing `webclient/src`, run:

```powershell
cd webclient
bun run build
cd ..
Copy-Item -Path webclient\out\client.js -Destination engine\public\client\client.js -Force
```

Then commit the webclient source changes in `webclient/` and commit the refreshed bundled artifact `engine/public/client/client.js` in `engine/`.

## Verification

Useful checks before committing:

```powershell
node --check start.js
git -C webclient status --short
git -C engine status --short
```

For larger changes:

```powershell
cd webclient
bun run build
cd ..\engine
bun run build
```

The engine build may print existing missing-model warnings; the important result is that the build exits successfully.

## Do Not Commit

Do not commit generated dependencies, local runtime state, or local secrets:

- `node_modules/`
- `engine/.env`
- `engine/db.sqlite`
- `engine/data/pack/`
- `engine/data/players/`
- `engine/data/living-world/`
- `webclient/out/`
- `*.map` build artifacts unless there is an explicit reason

Always check status in the root, `engine`, and `webclient` before finishing.
