/*
Copyright 2018-2025 New Vector Ltd.
Copyright 2017-2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Squirrel on windows starts the app with various flags as hooks to tell us when we've been installed/uninstalled etc.
import "./squirrelhooks.js";
import {
    app,
    BrowserWindow,
    Menu,
    autoUpdater,
    dialog,
    type Input,
    type Event,
    session,
    protocol,
    desktopCapturer,
} from "electron";
// eslint-disable-next-line n/file-extension-in-import
import * as Sentry from "@sentry/electron/main";
import path, { dirname } from "node:path";
import windowStateKeeper from "electron-window-state";
import fs from "node:fs";
import { URL, fileURLToPath } from "node:url";
import minimist from "minimist";

import "./ipc.js";
import "./seshat.js";
import "./settings.js";
import "./badge.js";
import * as tray from "./tray.js";
import Store from "./store.js";
import { buildMenuTemplate } from "./vectormenu.js";
import webContentsHandler from "./webcontents-handler.js";
import * as updater from "./updater.js";
import ProtocolHandler from "./protocol.js";
import { _t, AppLocalization } from "./language-helper.js";
import { setDisplayMediaCallback } from "./displayMediaCallback.js";
import { setupMacosTitleBar } from "./macos-titlebar.js";
import { type Json, loadJsonFile } from "./utils.js";
import { setupMediaAuth } from "./media-auth.js";
import { getBuildConfig } from "./build-config.js";
import { getAsarPath } from "./asar.js";
import { getIconPath } from "./icon.js";
import { TorService, type BootstrapEvent } from "./TorService.js";
import { TorSplash } from "./TorSplash.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const argv = minimist(process.argv, {
    alias: { help: "h" },
});

if (argv["help"]) {
    console.log("Options:");
    console.log("  --profile-dir {path}: Path to where to store the profile.");
    console.log(
        `  --profile {name}:     Name of alternate profile to use, allows for running multiple accounts.\n` +
            `                         Ignored if --profile-dir is specified.\n` +
            `                         The ELEMENT_PROFILE_DIR environment variable may be used to change the default profile path.\n` +
            `                         It is overridden by --profile-dir, but can be combined with --profile.`,
    );
    console.log("  --devtools:           Install and use react-devtools and react-perf.");
    console.log(
        `  --config:             Path to the config.json file. May also be specified via the ELEMENT_DESKTOP_CONFIG_JSON environment variable.\n` +
            `                         Otherwise use the default user location '${app.getPath("userData")}'`,
    );
    console.log("  --no-update:          Disable automatic updating.");
    console.log("  --hidden:             Start the application hidden in the system tray.");
    console.log("  --help:               Displays this help message.");
    console.log("And more such as --proxy, see: https://electronjs.org/docs/api/command-line-switches");
    app.exit();
}

const LocalConfigLocation = process.env.ELEMENT_DESKTOP_CONFIG_JSON ?? argv["config"];
const LocalConfigFilename = "config.json";

function isRealUserDataDir(d: string): boolean {
    return fs.existsSync(path.join(d, "IndexedDB"));
}

const buildConfig = getBuildConfig();
const protocolHandler = new ProtocolHandler(buildConfig.protocol);

let userDataPath: string;

const userDataPathInProtocol = protocolHandler.getProfileFromDeeplink(argv["_"]);
if (userDataPathInProtocol) {
    userDataPath = userDataPathInProtocol;
} else if (argv["profile-dir"]) {
    userDataPath = argv["profile-dir"];
} else {
    let newUserDataPath = process.env.ELEMENT_PROFILE_DIR ?? app.getPath("userData");
    if (argv["profile"]) {
        newUserDataPath += "-" + argv["profile"];
    }
    const newUserDataPathExists = isRealUserDataDir(newUserDataPath);
    let oldUserDataPath = path.join(app.getPath("appData"), app.getName().replace("Element", "Riot"));
    if (argv["profile"]) {
        oldUserDataPath += "-" + argv["profile"];
    }

    const oldUserDataPathExists = isRealUserDataDir(oldUserDataPath);
    console.log(newUserDataPath + " exists: " + (newUserDataPathExists ? "yes" : "no"));
    console.log(oldUserDataPath + " exists: " + (oldUserDataPathExists ? "yes" : "no"));
    if (!newUserDataPathExists && oldUserDataPathExists) {
        console.log("Using legacy user data path: " + oldUserDataPath);
        userDataPath = oldUserDataPath;
    } else {
        userDataPath = newUserDataPath;
    }
}
app.setPath("userData", userDataPath);

const homeserverProps = ["default_is_url", "default_hs_url", "default_server_name", "default_server_config"] as const;

function loadLocalConfigFile(): Json {
    if (LocalConfigLocation) {
        console.log("Loading local config: " + LocalConfigLocation);
        return loadJsonFile(LocalConfigLocation);
    } else {
        const configDir = app.getPath("userData");
        console.log(`Loading local config: ${path.join(configDir, LocalConfigFilename)}`);
        return loadJsonFile(configDir, LocalConfigFilename);
    }
}

let loadConfigPromise: Promise<void> | undefined;
function loadConfig(): Promise<void> {
    if (loadConfigPromise) return loadConfigPromise;

    async function actuallyLoadConfig(): Promise<void> {
        const asarPath = await getAsarPath();

        try {
            console.log(`Loading app config: ${path.join(asarPath, LocalConfigFilename)}`);
            global.vectorConfig = loadJsonFile(asarPath, LocalConfigFilename);
        } catch {
            global.vectorConfig = {};
        }

        try {
            const localConfig = loadLocalConfigFile();

            if (Object.keys(localConfig).find((k) => homeserverProps.includes(<any>k))) {
                global.vectorConfig = Object.keys(global.vectorConfig)
                    .filter((k) => !homeserverProps.includes(<any>k))
                    .reduce(
                        (obj, key) => {
                            obj[key] = global.vectorConfig[key];
                            return obj;
                        },
                        {} as Omit<Partial<(typeof global)["vectorConfig"]>, keyof typeof homeserverProps>,
                    );
            }

            global.vectorConfig = Object.assign(global.vectorConfig, localConfig);
        } catch (e) {
            if (e instanceof SyntaxError) {
                await app.whenReady();
                void dialog.showMessageBox({
                    type: "error",
                    title: `Your ${global.vectorConfig.brand || "Element"} is misconfigured`,
                    message:
                        `Your custom ${global.vectorConfig.brand || "Element"} configuration contains invalid JSON. ` +
                        `Please correct the problem and reopen ${global.vectorConfig.brand || "Element"}.`,
                    detail: e.message || "",
                });
            }
        }

        if (Array.isArray(global.vectorConfig.modules)) {
            global.vectorConfig.modules = global.vectorConfig.modules.map((m) => {
                if (m.startsWith("/")) {
                    return "/webapp" + m;
                }
                return m;
            });
        }
    }
    loadConfigPromise = actuallyLoadConfig();
    return loadConfigPromise;
}

async function configureSentry(): Promise<void> {
    await loadConfig();
    const { dsn, environment } = global.vectorConfig.sentry || {};
    if (dsn) {
        console.log(`Enabling Sentry with dsn=${dsn} environment=${environment}`);
        Sentry.init({
            dsn,
            environment,
            ipcMode: Sentry.IPCMode.Classic,
        });
    }
}

global.appQuitting = false;

const exitShortcuts: Array<(input: Input, platform: string) => boolean> = [
    (input, platform): boolean => platform !== "darwin" && input.alt && input.key.toUpperCase() === "F4",
    (input, platform): boolean => platform !== "darwin" && input.control && input.key.toUpperCase() === "Q",
    (input, platform): boolean =>
        platform === "darwin" && input.meta && !input.control && input.key.toUpperCase() === "Q",
];

void configureSentry();

process.on("uncaughtException", function (error: Error): void {
    console.log("Unhandled exception", error);
});

app.commandLine.appendSwitch("--enable-usermedia-screen-capturing");
if (!app.commandLine.hasSwitch("enable-features")) {
    app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    console.log("Other instance detected: exiting");
    app.exit();
}

protocolHandler.initialise(userDataPath);

protocol.registerSchemesAsPrivileged([
    {
        scheme: "vector",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
        },
    },
]);

app.enableSandbox();

app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");

const store = Store.initialize(argv["storage-mode"]);

if (store.get("disableHardwareAcceleration")) {
    console.log("Disabling hardware acceleration.");
    app.disableHardwareAcceleration();
}

// Global TorService instance — lives in the main process only
const torService = new TorService();

// Ensure Tor is killed on OS-level signals and synchronous exits
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(sig, () => {
        torService.stop();
        setTimeout(() => process.exit(0), 500);
    });
}
process.on("exit", () => {
    torService.stop();
});

app.on("ready", async () => {
    console.debug("Reached Electron ready state");

    let asarPath: string;

    try {
        asarPath = await getAsarPath();
        await loadConfig();
    } catch (e) {
        console.log("App setup failed: exiting", e);
        process.exit(1);
        return;
    }

    // Show splash screen while Tor bootstraps
    const splash = new TorSplash();
    splash.show();

    try {
        console.log("[Tor] Starting Tor bootstrap...");

        torService.on(TorService.EVENT_BOOTSTRAP, (event: BootstrapEvent) => {
            console.log(`[Tor] Bootstrap ${event.percent}% — ${event.summary}`);
            splash.update(event);
        });

        await torService.start();
        console.log("[Tor] Bootstrap complete, applying proxy...");

        await session.defaultSession.setProxy({
            proxyRules: torService.proxyUrl,
            proxyBypassRules: "<local>",
        });

        console.log(`[Tor] Proxy set: ${torService.proxyUrl}`);
    } catch (e) {
        console.error("[Tor] Failed to start Tor:", e);
        splash.close();
        const errorMessage = e instanceof Error ? e.message : String(e);
        const { response } = await dialog.showMessageBox({
            type: "error",
            title: "Failed to connect to Tor",
            message: "element-tor could not connect to the Tor network.",
            detail: errorMessage,
            buttons: ["Quit", "Continue without Tor"],
            defaultId: 0,
            cancelId: 1,
        });
        if (response === 0) {
            app.exit(1);
            return;
        }
    } finally {
        splash.close();
    }

    if (argv["devtools"]) {
        try {
            const { installExtension, REACT_DEVELOPER_TOOLS } = await import("electron-devtools-installer");
            installExtension(REACT_DEVELOPER_TOOLS)
                .then((ext) => console.log(`Added Extension: ${ext.name}`))
                .catch((err: unknown) => console.log("An error occurred: ", err));
        } catch (e) {
            console.log(e);
        }
    }

    protocol.registerFileProtocol("vector", (request, callback) => {
        if (request.method !== "GET") {
            callback({ error: -322 });
            return null;
        }

        const parsedUrl = new URL(request.url);
        if (parsedUrl.protocol !== "vector:") {
            callback({ error: -302 });
            return;
        }
        if (parsedUrl.host !== "vector") {
            callback({ error: -105 });
            return;
        }

        const target = parsedUrl.pathname.split("/");

        if (target[0] !== "") {
            callback({ error: -6 });
            return;
        }

        if (target[target.length - 1] == "") {
            target[target.length - 1] = "index.html";
        }

        let baseDir: string;
        if (target[1] === "webapp") {
            baseDir = asarPath;
        } else {
            callback({ error: -6 });
            return;
        }

        baseDir = path.normalize(baseDir);

        const relTarget = path.normalize(path.join(...target.slice(2)));
        if (relTarget.startsWith("..")) {
            callback({ error: -6 });
            return;
        }
        const absTarget = path.join(baseDir, relTarget);

        callback({
            path: absTarget,
        });
    });

    if (argv["update"] === false) {
        console.log("Auto update disabled via command line flag");
    } else if (global.vectorConfig["update_base_url"]) {
        void updater.start(global.vectorConfig["update_base_url"]);
    } else {
        console.log("No update_base_url is defined: auto update is disabled");
    }

    global.appLocalization = new AppLocalization({
        components: [(): void => tray.initApplicationMenu(), (): void => Menu.setApplicationMenu(buildMenuTemplate())],
        store,
    });

    const mainWindowState = windowStateKeeper({
        defaultWidth: 1024,
        defaultHeight: 768,
    });

    console.debug("Opening main window");
    const preloadScript = path.normalize(`${__dirname}/preload.cjs`);
    global.mainWindow = new BrowserWindow({
        backgroundColor: "#fff",
        titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
        trafficLightPosition: { x: 9, y: 8 },
        icon: await getIconPath(),
        show: false,
        autoHideMenuBar: store.get("autoHideMenuBar"),
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: preloadScript,
            nodeIntegration: false,
            contextIsolation: true,
            webgl: true,
        },
    });

    global.mainWindow.setContentProtection(store.get("enableContentProtection"));

    try {
        console.debug("Ensuring storage is ready");
        if (!(await store.prepareSafeStorage(global.mainWindow.webContents.session))) return;
    } catch (e) {
        console.error(e);
        app.exit(1);
    }

    void global.mainWindow.loadURL("vector://vector/webapp/");

    if (process.platform === "darwin") {
        setupMacosTitleBar(global.mainWindow);
    }

    global.mainWindow.webContents.session.setSpellCheckerEnabled(store.get("spellCheckerEnabled", true));

    if (store.get("minimizeToTray")) await tray.create();

    global.mainWindow.once("ready-to-show", () => {
        if (!global.mainWindow) return;
        mainWindowState.manage(global.mainWindow);

        if (!argv["hidden"]) {
            global.mainWindow.show();
        } else {
            global.mainWindow.hide();
        }
    });

    global.mainWindow.webContents.on("before-input-event", (event: Event, input: Input): void => {
        const exitShortcutPressed =
            input.type === "keyDown" && exitShortcuts.some((shortcutFn) => shortcutFn(input, process.platform));

        if (!exitShortcutPressed || !global.mainWindow) return;

        event.preventDefault();

        const shouldWarnBeforeExit = store.get("warnBeforeExit", true);
        if (shouldWarnBeforeExit) {
            const shouldCancelCloseRequest =
                dialog.showMessageBoxSync(global.mainWindow, {
                    type: "question",
                    buttons: [
                        _t("action|cancel"),
                        _t("action|close_brand", {
                            brand: global.vectorConfig.brand || "Element",
                        }),
                    ],
                    message: _t("confirm_quit"),
                    defaultId: 1,
                    cancelId: 0,
                }) === 0;
            if (shouldCancelCloseRequest) return;
        }

        app.quit();
    });

    global.mainWindow.on("closed", () => {
        global.mainWindow = null;
    });

    global.mainWindow.on("close", async (e) => {
        if (!global.appQuitting && (tray.hasTray() || process.platform === "darwin")) {
            e.preventDefault();

            if (global.mainWindow?.isFullScreen()) {
                global.mainWindow.once("leave-full-screen", () => global.mainWindow?.hide());
                global.mainWindow.setFullScreen(false);
            } else {
                global.mainWindow?.hide();
            }

            return false;
        }
    });

    if (process.platform === "win32") {
        global.mainWindow.on("app-command", (e, cmd) => {
            if (cmd === "browser-backward" && global.mainWindow?.webContents.canGoBack()) {
                global.mainWindow.webContents.goBack();
            } else if (cmd === "browser-forward" && global.mainWindow?.webContents.canGoForward()) {
                global.mainWindow.webContents.goForward();
            }
        });
    }

    webContentsHandler(global.mainWindow.webContents);

    session.defaultSession.setDisplayMediaRequestHandler(
        (_, callback) => {
            if (process.env.XDG_SESSION_TYPE === "wayland") {
                desktopCapturer
                    .getSources({ types: ["screen", "window"] })
                    .then((sources) => {
                        callback({ video: sources[0] });
                    })
                    .catch((err) => {
                        console.error("Wayland: failed to get user-selected source:", err);
                        callback({ video: { id: "", name: "" } });
                    });
            } else {
                global.mainWindow?.webContents.send("openDesktopCapturerSourcePicker");
            }
            setDisplayMediaCallback(callback);
        },
        { useSystemPicker: true },
    );

    setupMediaAuth(global.mainWindow);
});

app.on("window-all-closed", () => {
    app.quit();
});

app.on("activate", () => {
    global.mainWindow?.show();
});

function beforeQuit(): void {
    global.appQuitting = true;
    global.mainWindow?.webContents.send("before-quit");
    torService.stop();

    // Delay app exit slightly to allow Tor exit event to flush
    app.on("will-quit", (e) => {
        e.preventDefault();
        setTimeout(() => app.exit(0), 500);
    });
}

app.on("before-quit", beforeQuit);
autoUpdater.on("before-quit-for-update", beforeQuit);

app.on("second-instance", (ev, commandLine, workingDirectory) => {
    if (commandLine.includes("--hidden")) return;

    if (global.mainWindow) {
        if (!global.mainWindow.isVisible()) global.mainWindow.show();
        if (global.mainWindow.isMinimized()) global.mainWindow.restore();
        global.mainWindow.focus();
    }
});

app.setAppUserModelId(buildConfig.appId);