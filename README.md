<div align="center">
    <h1>Lost City</h1>
</div>

> [!NOTE]
> Learn about our history and ethos on our forum: https://lostcity.rs/t/faq-what-is-lost-city/16

This is a higher-level repository that links our other projects. You'll notice it's like home-rolled submodules (without commit references).  
Github won't include submodules in web downloads, and we have a lot of users who end up clicking download zip.

## Getting Started

> [!IMPORTANT]
> If you run into issues, please see our [common issues](#common-issues).

1. Download and extract this repo somewhere on your computer.
2. Install our [dependencies](#dependencies).
3. Open the folder you downloaded: **Run the start script and follow the on-screen prompts.** You may disregard any severity warnings you see.

Once your setup process has completed, wait for it to tell you the world has started before trying to play at: http://localhost/rs2.cgi

You can press `ctrl + c` to cancel/quit out of a terminal process.

## This Modded World

This workspace targets revision 274 and includes a zoomable extended-distance web client, configurable XP rates, a single configured administrator account (`mod` by default), and a persistent living world of up to 200 simulated adventurers. Adventurer bots travel, skill, chat, bank their gathered resources, and sell those resources when you use the normal **Trade with** player option. After inspecting a bot's stock, use `::botbuy <item> <amount>` to purchase and `::botstock` to refresh the offer.

Runtime settings live in the ignored `engine/data/config/world.json` file. In particular, `node.adminUsername`, `node.adminPasswordHash`, `node.xpRate`, and `node.livingWorld` control the protected administrator, XP multiplier, and bot population without rebuilding the code. Only the configured administrator receives staff level 4; all other local accounts receive staff level 0.

Local character passwords are bcrypt-hashed in the ignored `engine/data/config/local-accounts.json` file. After upgrading from the former passwordless behavior, an unclaimed character adopts the password used for its first successful login. Subsequent logins must use that password. Use **Manage Characters** from `start.bat` to set a password in advance or change it later.

## Tailnet Access

Tailscale Serve exposes the running game to connected tailnet devices at `https://lc.tail4b7602.ts.net/`. HTTPS and secure WebSocket traffic are proxied to the game server on `http://127.0.0.1:80`; this is tailnet-only and is not a public Funnel.

The Serve configuration persists, but the game server must be running. After a reboot, run `start.bat` and select **Start Server**. Inspect or disable the proxy from an elevated terminal with `tailscale serve status` or `tailscale serve --https=443 off`.

## Character Saves

This fork keeps portable character saves in `saves/players/` so they can move with the launcher repo. On first startup, `start.js` restores that snapshot into `engine/data/players/` if the engine save folder is empty. When the server stops, `start.js` refreshes `saves/players/` from the live engine saves.

After playing, commit and push changes under `saves/players/` if you want those character saves to appear on another PC.

## Character Manager

Run `start.bat` and choose **Manage Characters** while the game server is stopped. The manager can:

- inspect character stats, position, inventory, and bank contents;
- change any character password, including the configured administrator;
- import, replace, clone, rename, back up, or delete saves;
- edit skill levels or exact XP and move a character to exact coordinates; and
- add, remove, or clear items in persistent inventory, bank, and worn containers.

The manager validates save checksums, creates a recovery copy under the ignored `saves/backups/` directory before destructive changes, and regenerates the save checksum after structured edits. Character names come from the `.sav` filename; passwords are stored separately and never embedded in tracked save snapshots.

## Dependencies

- Git CLI - Windows users: [git-scm](https://git-scm.com/)
- [NodeJS 24+](https://nodejs.org/)

> [!TIP]
> If you're using VS Code (recommended), [we have an extension to install on the marketplace.](https://marketplace.visualstudio.com/items?itemName=2004scape.runescriptlanguage)

## Workflow

**Use the start script provided** - it handles a lot of common use cases. We're trying to reduce the barrier to entry by providing an all-inclusive script.

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [LICENSE](LICENSE) file for details.
