export function installWorldMapPanel(): void {
    if (document.getElementById('lostcity-world-map-panel')) {
        return;
    }

    installStyles();

    const controls: HTMLElement | null = document.getElementById('controls');
    const triggers: HTMLButtonElement[] = [];
    const createTrigger = (id: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.textContent = 'World Map';
        button.setAttribute('aria-haspopup', 'dialog');
        triggers.push(button);
        return button;
    };

    const trigger = createTrigger('lostcity-world-map-trigger');
    const floatingTrigger = createTrigger('lostcity-world-map-floating-trigger');
    floatingTrigger.classList.add('floating');

    if (controls) {
        controls.append(' | ');
        controls.appendChild(trigger);
        document.body.appendChild(floatingTrigger);

        const syncFloatingTrigger = (): void => {
            floatingTrigger.hidden = getComputedStyle(controls).display !== 'none';
        };
        syncFloatingTrigger();
        new MutationObserver(syncFloatingTrigger).observe(controls, { attributes: true, attributeFilter: ['style', 'class'] });
    } else {
        document.body.appendChild(floatingTrigger);
    }

    const panel = document.createElement('div');
    panel.id = 'lostcity-world-map-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'World map');

    const header = document.createElement('div');
    header.className = 'lostcity-world-map-header';

    const title = document.createElement('strong');
    title.textContent = 'World Map';

    const note = document.createElement('span');
    note.textContent = 'Local map — drag to pan and use the mouse wheel to zoom';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close world map');
    header.append(title, note, close);

    const frame = document.createElement('iframe');
    frame.title = 'Lost City world map';
    frame.loading = 'lazy';
    frame.src = 'about:blank';
    panel.append(header, frame);
    document.body.appendChild(panel);

    let loaded = false;
    const setOpen = (open: boolean): void => {
        if (open && !loaded) {
            frame.src = '/worldmap.html';
            loaded = true;
        }
        panel.hidden = !open;
        for (const item of triggers) {
            item.classList.toggle('open', open);
            item.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (open) {
            close.focus();
        }
    };

    for (const item of triggers) {
        item.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(panel.hidden);
        });
    }
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            event.preventDefault();
            setOpen(false);
        }
    });
}

function installStyles(): void {
    const style = document.createElement('style');
    style.id = 'lostcity-world-map-style';
    style.textContent = `
        #lostcity-world-map-trigger,
        #lostcity-world-map-floating-trigger {
            color: #04A800;
            background: transparent;
            border: 0;
            padding: 0;
            cursor: pointer;
            font: 12px Arial, Helvetica, sans-serif;
        }
        #lostcity-world-map-trigger:hover,
        #lostcity-world-map-trigger.open,
        #lostcity-world-map-floating-trigger:hover,
        #lostcity-world-map-floating-trigger.open { text-decoration: underline; }
        #lostcity-world-map-floating-trigger.floating {
            position: fixed;
            right: 180px;
            bottom: 12px;
            z-index: 10000;
            padding: 5px 8px;
            color: #04A800;
            background: #000;
            border: 1px solid #04A800;
        }
        #lostcity-world-map-panel {
            position: fixed;
            inset: 18px;
            z-index: 11000;
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            overflow: hidden;
            color: #fff;
            background: #050505;
            border: 1px solid #04A800;
            box-shadow: 0 12px 48px rgba(0, 0, 0, .9);
            font: 12px Arial, Helvetica, sans-serif;
        }
        #lostcity-world-map-panel[hidden] { display: none; }
        .lostcity-world-map-header {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 14px;
            padding: 8px 10px;
            background: #101010;
            border-bottom: 1px solid #333;
        }
        .lostcity-world-map-header span { color: #999; }
        .lostcity-world-map-header button {
            padding: 3px 9px;
            color: #04A800;
            background: #050505;
            border: 1px solid #333;
            cursor: pointer;
            font: inherit;
        }
        .lostcity-world-map-header button:hover { border-color: #04A800; }
        #lostcity-world-map-panel iframe {
            width: 100%;
            height: 100%;
            border: 0;
            background: #000;
        }
        @media (max-width: 600px) {
            #lostcity-world-map-panel { inset: 6px; }
            .lostcity-world-map-header span { display: none; }
            .lostcity-world-map-header { grid-template-columns: 1fr auto; }
        }
    `;
    document.head.appendChild(style);
}
