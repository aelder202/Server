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

## Character Saves

This fork keeps portable character saves in `saves/players/` so they can move with the launcher repo. On first startup, `start.js` restores that snapshot into `engine/data/players/` if the engine save folder is empty. When the server stops, `start.js` refreshes `saves/players/` from the live engine saves.

After playing, commit and push changes under `saves/players/` if you want those character saves to appear on another PC.

## Dependencies

- Git CLI - Windows users: [git-scm](https://git-scm.com/)
- [NodeJS 24+](https://nodejs.org/)

> [!TIP]
> If you're using VS Code (recommended), [we have an extension to install on the marketplace.](https://marketplace.visualstudio.com/items?itemName=2004scape.runescriptlanguage)

## Workflow

**Use the start script provided** - it handles a lot of common use cases. We're trying to reduce the barrier to entry by providing an all-inclusive script.

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [LICENSE](LICENSE) file for details.
