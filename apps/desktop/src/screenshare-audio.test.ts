/*
Copyright 2026 5TN1rcZRS79VAEFuUCRB

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "node:events";
import { type ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    addScreenshareAudio,
    appRootProcess,
    askAudioScope,
    findX11WindowByTitle,
    parseKdeRestoreData,
    parsePortalPick,
    parseWaylandClients,
    resolveShellWindow,
    type WindowLookup,
    audioScopeFor,
    findWindowsWindowApp,
    findX11WindowApp,
    isDescendantOf,
    isScreenshareAudioSupported,
    appIdFromCgroup,
    desktopEntryName,
    listAudioApps,
    listRunningApps,
    mergeAudioApps,
    MIX_NODE_NAME,
    mixChannelsFor,
    parseSourceId,
    type PipeWireObject,
    planLinks,
    ScreenshareAudio,
    SOURCE_LABEL,
    SOURCE_NODE_NAME,
    WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO,
    windowsApplicationLoopback,
    windowsPowerShell,
    wrapDisplayMediaCallback,
} from "./screenshare-audio.js";

const { mockStore, osRelease } = vi.hoisted(() => ({
    mockStore: { get: vi.fn<(key: string) => unknown>() },
    osRelease: vi.fn<() => string>(() => "10.0.22631"),
}));

vi.mock("node:os", () => ({ release: osRelease }));

const { showMessageBox } = vi.hoisted(() => ({
    showMessageBox: vi.fn<(...args: unknown[]) => Promise<{ response: number }>>(),
}));
vi.mock("electron", () => ({ webFrameMain: { fromId: vi.fn() }, dialog: { showMessageBox } }));
vi.mock("./language-helper.js", () => ({ _t: (key: string) => key }));
vi.mock("./config.js", () => ({ getConfig: () => ({ brand: "Element" }) }));
vi.mock("./store.js", () => ({ default: { instance: mockStore } }));

const MIX = 10;
const SOURCE = 11;
const APP = 20;
const OTHER_APP = 25;
const OWN = 30;
const FILTER = 40;
const RECORDER = 50;

function node(id: number, props: Record<string, unknown>): PipeWireObject {
    return { id, type: "PipeWire:Interface:Node", info: { props } };
}
function port(id: number, nodeId: number, direction: string, channel: string, extra = {}): PipeWireObject {
    return {
        id,
        type: "PipeWire:Interface:Port",
        info: { direction, props: { "node.id": nodeId, "audio.channel": channel, ...extra } },
    };
}
function link(outputNode: number, outputPort: number, inputNode: number, inputPort: number): PipeWireObject {
    return {
        id: 1000 + outputPort * 10 + inputPort,
        type: "PipeWire:Interface:Link",
        info: {
            "output-node-id": outputNode,
            "output-port-id": outputPort,
            "input-node-id": inputNode,
            "input-port-id": inputPort,
        },
    };
}

/** A graph with our loopback, another app, Element's own playback and a filter stream. */
function graph(extra: PipeWireObject[] = []): PipeWireObject[] {
    return [
        node(MIX, { "node.name": MIX_NODE_NAME, "media.class": "Stream/Input/Audio" }),
        node(SOURCE, { "node.name": SOURCE_NODE_NAME, "media.class": "Audio/Source" }),
        node(APP, { "node.name": "firefox", "media.class": "Stream/Output/Audio", "application.process.id": 200 }),
        // A native PipeWire client: the process id is only on its client object.
        node(OTHER_APP, { "node.name": "mpv", "media.class": "Stream/Output/Audio", "client.id": 60 }),
        { id: 60, type: "PipeWire:Interface:Client", info: { props: { "application.process.id": 250 } } },
        node(OWN, { "node.name": "element", "media.class": "Stream/Output/Audio", "application.process.id": 300 }),
        node(FILTER, { "node.name": "easyeffects", "media.class": "Stream/Output/Audio", "node.link-group": "g" }),
        node(RECORDER, { "node.name": "element-rec", "media.class": "Stream/Input/Audio" }),
        port(101, MIX, "input", "FL"),
        port(102, MIX, "input", "FR"),
        port(111, SOURCE, "output", "FL"),
        port(201, APP, "output", "FL"),
        port(202, APP, "output", "FR"),
        port(203, APP, "output", "FL", { "port.monitor": true }),
        port(251, OTHER_APP, "output", "MONO"),
        port(301, OWN, "output", "FL"),
        port(401, FILTER, "output", "FL"),
        ...extra,
    ];
}

/** Share every app except Element (pid 300). */
const allButOwn = (pid: number): boolean => pid !== 300;
/** Share only Firefox (pid 200). */
const firefoxOnly = (pid: number): boolean => pid === 200;

describe("isScreenshareAudioSupported", () => {
    it.each([
        ["linux", "7.3.6-arch1-1", true],
        ["win32", "10.0.22631", true],
        ["win32", "10.0.22000", true],
        ["win32", "10.0.19045", false],
        ["darwin", "25.1.0", false],
    ])("%s %s -> %s", (platform, release, expected) => {
        expect(isScreenshareAudioSupported(platform, release)).toBe(expected);
    });
});

describe("mixChannelsFor", () => {
    it.each([
        ["FL", ["FL"]],
        ["RR", ["FR"]],
        ["MONO", ["FL", "FR"]],
        ["FC", ["FL", "FR"]],
        [undefined, ["FL", "FR"]],
        ["LFE", []],
    ])("maps %s to %j", (channel, expected) => {
        expect(mixChannelsFor(channel)).toEqual(expected);
    });
});

describe("planLinks", () => {
    it("links other apps' playback into the mix, but not Element's own or filter streams", () => {
        const plan = planLinks(graph(), allButOwn, false);
        expect(plan.keepRunning).toBe(true);
        expect(plan.links).toEqual([
            [201, 101],
            [202, 102],
            [251, 101],
            [251, 102],
        ]);
        expect(plan.unlinks).toEqual([]);
    });

    it("links only the shared window's app", () => {
        const plan = planLinks(graph(), firefoxOnly, false);
        expect(plan.links).toEqual([
            [201, 101],
            [202, 102],
        ]);
    });

    it("unlinks apps that should no longer be shared", () => {
        const stale = link(OTHER_APP, 251, MIX, 101);
        const plan = planLinks(graph([link(APP, 201, MIX, 101), stale]), firefoxOnly, false);
        expect(plan.unlinks).toEqual([stale.id]);
        expect(plan.links).toEqual([[202, 102]]);
    });

    it("skips links that already exist", () => {
        const plan = planLinks(graph([link(APP, 201, MIX, 101)]), firefoxOnly, false);
        expect(plan.links).toEqual([[202, 102]]);
    });

    it("stops when the loopback nodes are gone", () => {
        const plan = planLinks(graph().slice(2), allButOwn, false);
        expect(plan.keepRunning).toBe(false);
    });

    it("stops when nothing records from the source and stopping is allowed", () => {
        expect(planLinks(graph(), allButOwn, true).keepRunning).toBe(false);
    });

    it("keeps running while the source is recorded", () => {
        const plan = planLinks(graph([link(SOURCE, 111, RECORDER, 999)]), allButOwn, true);
        expect(plan).toMatchObject({ keepRunning: true, inUse: true });
    });
});

describe("listAudioApps", () => {
    it("lists other apps once each, by name, without Element or filter streams", () => {
        const objects = graph([
            node(60, {
                "media.class": "Stream/Output/Audio",
                "application.process.id": 201,
                "application.name": "Firefox",
            }),
            {
                id: 60,
                type: "PipeWire:Interface:Client",
                info: { props: { "application.process.id": 250, "application.name": "mpv" } },
            },
        ]);
        // Process 201 is a child of Firefox's main process 200.
        const apps = listAudioApps(
            objects,
            (pid) => pid === 300,
            (pid) => (pid === 201 ? 200 : pid),
        );
        expect(apps).toEqual([
            { pids: [200], name: "firefox", playing: true },
            { pids: [250], name: "mpv", playing: true },
        ]);
    });
});

describe("appIdFromCgroup", () => {
    const at = (unit: string): string => `0::/user.slice/user-1000.slice/user@1000.service/app.slice/${unit}\n`;
    it.each([
        [at("app-gnome-librewolf-1014346.scope"), "librewolf"],
        [at("app-gnome-io.element.Element-747963.scope"), "io.element.Element"],
        [at("app-flatpak-org.mozilla.firefox-4242.scope"), "org.mozilla.firefox"],
        [at("app-gnome-gnome\\x2dcontrol\\x2dcenter-99.scope"), "gnome-control-center"],
        [at("app-org.kde.dolphin@a1b2c3.service"), "org.kde.dolphin"],
        [at("app-Element-747963.scope"), "Element"],
        [
            at("app-dbus\\x2d:1.2\\x2dorg.gnome.Console.slice/dbus-:1.2-org.gnome.Console@0.service"),
            "org.gnome.Console",
        ],
        [at("app-gnome\\x2dsession\\x2dmanager.slice/gnome-session-manager@gnome.service"), undefined],
        [at("syncthing.service"), undefined],
        ["0::/user.slice/user-1000.slice/session-2.scope\n", undefined],
    ])("reads %j", (cgroup, appId) => {
        expect(appIdFromCgroup(cgroup)).toBe(appId);
    });
});

describe("desktopEntryName", () => {
    const files: Record<string, string> = {
        "/home/a/applications/librewolf.desktop":
            "[Desktop Entry]\nType=Application\nName=LibreWolf\n[Desktop Action new]\nName=New Window\n",
        "/usr/applications/helper.desktop": "[Desktop Entry]\nName=Helper\nNoDisplay=true\n",
        "/usr/applications/librewolf.desktop": "[Desktop Entry]\nName=Not this one\n",
    };
    const readFile = (path: string): string => {
        if (!(path in files)) throw new Error("ENOENT");
        return files[path];
    };
    const dirs = ["/home/a/applications", "/usr/applications"];

    it("reads the Name of the first .desktop file found", () => {
        expect(desktopEntryName("librewolf", dirs, readFile)).toBe("LibreWolf");
    });

    it("leaves out hidden and missing entries", () => {
        expect(desktopEntryName("helper", dirs, readFile)).toBeUndefined();
        expect(desktopEntryName("missing", dirs, readFile)).toBeUndefined();
    });
});

describe("listRunningApps", () => {
    const unit = (name: string): string => `0::/user.slice/user-1000.slice/user@1000.service/app.slice/${name}\n`;
    const cgroups: Record<number, string> = {
        10: unit("app-gnome-librewolf-10.scope"),
        11: unit("app-gnome-librewolf-10.scope"),
        20: unit("app-gnome-todo-20.scope"),
        30: unit("app-gnome-io.element.Element-30.scope"),
        40: unit("app-gnome-xdg\\x2duser\\x2ddirs-40.scope"),
        50: "0::/user.slice/user-1000.slice/session-2.scope\n",
    };

    it("keeps only a unit's topmost processes", () => {
        const apps = listRunningApps(
            [70, 71],
            () => unit("app-gnome-org.gnome.Console-70.scope"),
            () => false,
            (pid) => pid,
            () => "Console",
            (pid, ancestor) => pid === ancestor || (pid === 71 && ancestor === 70),
        );
        expect(apps).toEqual([{ pids: [70], name: "Console", playing: false }]);
    });

    it("lists apps with a .desktop entry, once each, without Element", () => {
        const names: Record<string, string> = {
            "librewolf": "LibreWolf",
            "todo": "Endeavour",
            "io.element.Element": "Element",
        };
        const apps = listRunningApps(
            [10, 11, 20, 30, 40, 50, 60],
            (pid) => {
                if (!(pid in cgroups)) throw new Error("ESRCH");
                return cgroups[pid];
            },
            (pid) => pid === 30,
            (pid) => (pid === 11 ? 10 : pid),
            (appId) => names[appId],
            (pid, ancestor) => pid === ancestor,
        );
        expect(apps).toEqual([
            { pids: [10], name: "LibreWolf", playing: false },
            { pids: [20], name: "Endeavour", playing: false },
        ]);
    });
});

describe("mergeAudioApps", () => {
    it("marks running apps that play, adds playing apps outside units, playing first", () => {
        const running = [
            { pids: [20], name: "Endeavour", playing: false },
            { pids: [10], name: "LibreWolf", playing: false },
        ];
        const playing = [
            // LibreWolf's audio process walks up to its main process, 10.
            { pids: [10], name: "LibreWolf audio", playing: true },
            { pids: [90], name: "mpv", playing: true },
        ];
        expect(mergeAudioApps(running, playing)).toEqual([
            { pids: [10], name: "LibreWolf", playing: true },
            { pids: [90], name: "mpv", playing: true },
            { pids: [20], name: "Endeavour", playing: false },
        ]);
    });

    it("tells apart two instances of the same app", () => {
        const playing = [
            { pids: [10], name: "mpv", playing: true },
            { pids: [20], name: "mpv", playing: true },
        ];
        expect(mergeAudioApps([], playing).map((app) => app.name)).toEqual(["mpv (10)", "mpv (20)"]);
    });
});

describe("askAudioScope", () => {
    const apps = [
        { pids: [200], name: "Firefox", playing: true },
        { pids: [250, 251], name: "mpv", playing: false },
    ];

    it.each([
        [0, { apps: "all" }],
        [1, { apps: "one", pids: [200] }],
        [2, { apps: "one", pids: [250, 251] }],
        [3, { apps: "none" }],
    ])("maps button %i to %j", async (response, scope) => {
        showMessageBox.mockResolvedValueOnce({ response });
        await expect(askAudioScope(apps, null)).resolves.toEqual(scope);
        expect(showMessageBox).toHaveBeenLastCalledWith(
            expect.objectContaining({
                buttons: [
                    "screenshare_audio|all_apps",
                    "screenshare_audio|playing",
                    "mpv",
                    "screenshare_audio|no_audio",
                ],
                defaultId: 0,
                cancelId: 3,
            }),
        );
    });
});

describe("isDescendantOf", () => {
    // pid -> parent pid
    const tree: Record<number, number> = { 300: 250, 250: 100, 100: 1, 200: 1 };
    const readStat = (pid: number): string => {
        if (!(pid in tree)) throw new Error("no such process");
        return `${pid} (weird) name) S ${tree[pid]} 0 0`;
    };

    it("finds ancestors through the process tree", () => {
        expect(isDescendantOf(300, 100, readStat)).toBe(true);
        expect(isDescendantOf(100, 100, readStat)).toBe(true);
    });

    it("rejects unrelated and vanished processes", () => {
        expect(isDescendantOf(200, 100, readStat)).toBe(false);
        expect(isDescendantOf(999, 100, readStat)).toBe(false);
    });
});

describe("ScreenshareAudio", () => {
    let child: EventEmitter & { stdin: { end: ReturnType<typeof vi.fn> } };
    let runCommand: ReturnType<typeof vi.fn<(command: string, args: string[]) => Promise<string>>>;
    let spawnLoopback: ReturnType<typeof vi.fn<(args: string[]) => ChildProcess>>;
    let objects: PipeWireObject[];

    beforeEach(() => {
        child = Object.assign(new EventEmitter(), { stdin: { end: vi.fn() } });
        objects = graph();
        runCommand = vi.fn(async (command: string) => (command === "pw-dump" ? JSON.stringify(objects) : ""));
        spawnLoopback = vi.fn(() => child as unknown as ChildProcess);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("starts the loopback with our node names and links the apps' playback", async () => {
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        await expect(audio.start()).resolves.toBe(true);
        expect(audio.running).toBe(true);

        const args = spawnLoopback.mock.calls[0][0].join(" ");
        expect(args).toContain(`node.name=${MIX_NODE_NAME}`);
        expect(args).toContain(`node.name=${SOURCE_NODE_NAME}`);
        expect(runCommand).toHaveBeenCalledWith("pw-link", ["201", "101"]);
        expect(runCommand).toHaveBeenCalledWith("pw-link", ["202", "102"]);
        expect(runCommand).not.toHaveBeenCalledWith("pw-link", ["401", "101"]);
        audio.stop();
    });

    it("shares only the given app's process tree", async () => {
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        // Processes 200 and 250 are not descendants of this one, so only an exact match is shared.
        await audio.start([250]);
        expect(runCommand).toHaveBeenCalledWith("pw-link", ["251", "101"]);
        expect(runCommand).not.toHaveBeenCalledWith("pw-link", ["201", "101"]);
        audio.stop();
    });

    it("unlinks the previous app when a new share picks another window", async () => {
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        await audio.start([250]);
        const stale = link(OTHER_APP, 251, MIX, 101);
        objects = graph([stale]);
        await audio.start([200]);
        expect(runCommand).toHaveBeenCalledWith("pw-link", ["-d", String(stale.id)]);
        expect(runCommand).toHaveBeenCalledWith("pw-link", ["201", "101"]);
        expect(spawnLoopback).toHaveBeenCalledTimes(1);
        audio.stop();
    });

    it("stops after the renderer stops recording", async () => {
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        objects = graph([link(SOURCE, 111, RECORDER, 999)]);
        await audio.start();

        objects = graph();
        await audio.poll();
        expect(audio.running).toBe(false);
        expect(child.stdin.end).toHaveBeenCalled();
    });

    it("gives up if the virtual microphone never appears", async () => {
        vi.useFakeTimers();
        objects = [];
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        const started = audio.start();
        await vi.advanceTimersByTimeAsync(4000);
        await expect(started).resolves.toBe(false);
        expect(audio.running).toBe(false);
    });

    it("forgets the loopback when the process exits", async () => {
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        await audio.start();
        child.emit("exit", 0);
        expect(audio.running).toBe(false);
    });
});

describe("parseSourceId", () => {
    it.each([
        ["screen:0:0", { type: "screen", handle: 0 }],
        ["window:4198415:0", { type: "window", handle: 4198415 }],
        ["window:1:0", { type: "window", handle: 1 }],
        ["web-contents-media-stream://1:2", null],
        ["", null],
    ])("parses %j", (id, expected) => {
        expect(parseSourceId(id)).toEqual(expected);
    });
});

describe("audioScopeFor", () => {
    const isOwnProcess = (pid: number): boolean => pid === 300;

    it("shares all apps but Element for a whole screen", async () => {
        const findApp = vi.fn();
        await expect(audioScopeFor("screen:0:0", findApp, isOwnProcess)).resolves.toEqual({ apps: "all" });
        expect(findApp).not.toHaveBeenCalled();
    });

    it("shares only the window's app", async () => {
        const findApp = vi.fn(async () => 200);
        await expect(audioScopeFor("window:77:0", findApp, isOwnProcess)).resolves.toEqual({
            apps: "one",
            pids: [200],
        });
        expect(findApp).toHaveBeenCalledWith(77);
    });

    it("shares nothing for Element's own window", async () => {
        await expect(audioScopeFor("window:77:0", async () => 300, isOwnProcess)).resolves.toEqual({ apps: "none" });
    });

    it.each([
        ["the app is unknown (Wayland)", async () => undefined],
        ["the lookup fails", async () => Promise.reject(new Error("xprop: not found"))],
    ])("falls back to all apps but Element when %s", async (_, findApp) => {
        await expect(audioScopeFor("window:1:0", findApp, isOwnProcess)).resolves.toEqual({ apps: "all" });
    });
});

describe("appRootProcess", () => {
    const parents: Record<number, number> = { 40: 30, 30: 20, 20: 1 };
    const exes: Record<number, string> = { 40: "/usr/bin/app", 30: "/usr/bin/app", 20: "/usr/bin/launcher" };

    it("walks up through parents running the same executable", () => {
        expect(
            appRootProcess(
                40,
                (p) => exes[p],
                (p) => parents[p],
            ),
        ).toBe(30);
    });

    it("stops at processes it cannot read", () => {
        const readExe = (p: number): string => {
            if (p === 30) throw new Error("EACCES");
            return exes[p];
        };
        expect(appRootProcess(40, readExe, (p) => parents[p])).toBe(40);
    });
});

describe("findX11WindowApp", () => {
    it("reads the window's _NET_WM_PID", async () => {
        const runCommand = vi.fn(async () => `_NET_WM_PID(CARDINAL) = ${process.pid}\n`);
        const pid = await findX11WindowApp(4198415, runCommand);
        expect(runCommand).toHaveBeenCalledWith("xprop", ["-id", "4198415", "_NET_WM_PID"]);
        // It may walk up to a parent running the same executable as this test.
        expect(pid && isDescendantOf(process.pid, pid)).toBe(true);
    });

    it("returns undefined for windows without a pid", async () => {
        const runCommand = vi.fn(async () => "_NET_WM_PID:  not found.\n");
        await expect(findX11WindowApp(4198415, runCommand)).resolves.toBeUndefined();
    });
});

describe("windowsPowerShell", () => {
    it("is under the Windows system folder", () => {
        expect(windowsPowerShell("D:\\Win")).toBe("D:\\Win\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    });
});

describe("findWindowsWindowApp", () => {
    it("passes the window handle through the environment and reads the pid", async () => {
        const runCommand = vi.fn(async () => "1234\r\n");
        await expect(findWindowsWindowApp(65794, runCommand)).resolves.toBe(1234);
        const [command, args, env] = runCommand.mock.calls[0] as unknown as [string, string[], Record<string, string>];
        expect(command).toMatch(/[\\/]System32[\\/]WindowsPowerShell[\\/]v1\.0[\\/]powershell\.exe$/i);
        expect(env).toEqual({ ELEMENT_SCREENSHARE_HWND: "65794" });
        expect(args.join(" ")).not.toContain("65794");
    });

    it("returns undefined when no process was found", async () => {
        await expect(findWindowsWindowApp(1, async () => "0\r\n")).resolves.toBeUndefined();
    });
});

describe("wrapDisplayMediaCallback", () => {
    const originalPlatform = process.platform;
    const setPlatform = (platform: string): void => {
        Object.defineProperty(process, "platform", { value: platform });
    };
    const video = { id: "screen:1:0", name: "Screen" };
    const window = { id: "window:77:0", name: "Firefox" };

    beforeEach(() => {
        setPlatform("linux");
        mockStore.get.mockImplementation((key) => key === "shareSystemAudio");
    });

    afterEach(() => {
        setPlatform(originalPlatform);
        mockStore.get.mockReset();
    });

    it("starts the loopback before handing back the picked source", async () => {
        const audio = { start: vi.fn(async () => true) } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, { audio, wayland: false })({ video });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video }));
        expect(audio.start).toHaveBeenCalledWith(undefined);
    });

    it("starts the loopback for only the shared window's app", async () => {
        const audio = { start: vi.fn(async () => true) } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            findApp: async () => 200,
            wayland: false,
        })({ video: window });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video: window }));
        expect(audio.start).toHaveBeenCalledWith([200]);
    });

    it("shares no audio with Element's own window", async () => {
        const audio = { start: vi.fn(), stop: vi.fn() } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            findApp: async () => process.pid,
            wayland: false,
        })({ video: window });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video: window }));
        expect(callback).toHaveBeenCalledTimes(1);
        expect(audio.start).not.toHaveBeenCalled();
        expect(audio.stop).toHaveBeenCalled();
    });

    it("still hands back the source if the loopback fails", async () => {
        const audio = { start: vi.fn(async () => Promise.reject(new Error("no pipewire"))) };
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio: audio as unknown as ScreenshareAudio,
            wayland: false,
        })({ video });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video }));
    });

    it("does nothing when the picker was cancelled", () => {
        const audio = { start: vi.fn() } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, { audio })({ video: { id: "", name: "" } });
        expect(callback).toHaveBeenCalled();
        expect(audio.start).not.toHaveBeenCalled();
    });

    const noPick = (): { pick: () => Promise<undefined>; stop: () => void } => ({
        pick: async () => undefined,
        stop: vi.fn(),
    });
    const lookup = (overrides: Partial<WindowLookup> = {}): WindowLookup => ({
        unitProcesses: () => undefined,
        x11WindowProcess: async () => undefined,
        waylandClients: async () => [],
        commandLine: () => "",
        isOwnProcess: (pid) => pid === 1,
        rootOf: (pid) => pid,
        isDescendant: () => false,
        ...overrides,
    });

    it("shares the picked window's app on GNOME without asking", async () => {
        const audio = { start: vi.fn(async () => true), listApps: vi.fn() } as unknown as ScreenshareAudio;
        const askApp = vi.fn();
        const stop = vi.fn();
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            askApp,
            wayland: true,
            watchPortal: () => ({
                pick: async () => ({ type: "window" as const, window: { appId: "org.gnome.Console.desktop" } }),
                stop,
            }),
            windowLookup: () => lookup({ unitProcesses: (id) => (id === "org.gnome.Console" ? [300] : undefined) }),
        })({ video: window });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video: window }));
        expect(audio.start).toHaveBeenCalledWith([300]);
        expect(askApp).not.toHaveBeenCalled();
        expect(stop).toHaveBeenCalled();
    });

    it("shares all but Element for a picked screen on GNOME", async () => {
        const audio = { start: vi.fn(async () => true), listApps: vi.fn() } as unknown as ScreenshareAudio;
        const askApp = vi.fn();
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            askApp,
            wayland: true,
            watchPortal: () => ({ pick: async () => ({ type: "monitor" as const }), stop: vi.fn() }),
        })({ video: window });
        await vi.waitFor(() => expect(callback).toHaveBeenCalled());
        expect(audio.start).toHaveBeenCalledWith(undefined);
        expect(askApp).not.toHaveBeenCalled();
    });

    it("stops watching the portal when the picker is cancelled", () => {
        const stop = vi.fn();
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            wayland: true,
            watchPortal: () => ({ pick: async () => undefined, stop }),
        })({ video: { id: "", name: "" } });
        expect(stop).toHaveBeenCalled();
        expect(callback).toHaveBeenCalled();
    });

    it("asks which app to share on Wayland", async () => {
        const audio = {
            start: vi.fn(async () => true),
            listApps: vi.fn(async () => [{ pids: [250], name: "mpv", playing: true }]),
        } as unknown as ScreenshareAudio;
        const askApp = vi.fn(async () => ({ apps: "one" as const, pids: [250] }));
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            askApp,
            wayland: true,
            watchPortal: noPick,
        })({
            video: window,
        });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video: window }));
        expect(askApp).toHaveBeenCalledWith([{ pids: [250], name: "mpv", playing: true }]);
        expect(audio.start).toHaveBeenCalledWith([250]);
    });

    it("does not ask on Wayland when no other app is running", async () => {
        const audio = {
            start: vi.fn(async () => true),
            listApps: vi.fn(async () => []),
        } as unknown as ScreenshareAudio;
        const askApp = vi.fn();
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            askApp,
            wayland: true,
            watchPortal: noPick,
        })({
            video: window,
        });
        await vi.waitFor(() => expect(callback).toHaveBeenCalled());
        expect(askApp).not.toHaveBeenCalled();
        expect(audio.start).toHaveBeenCalledWith(undefined);
    });

    it("shares no audio on Wayland when the user says so", async () => {
        const audio = {
            start: vi.fn(),
            stop: vi.fn(),
            listApps: vi.fn(async () => [{ pids: [250], name: "mpv", playing: true }]),
        } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        const askApp = async (): Promise<{ apps: "none" }> => ({ apps: "none" });
        wrapDisplayMediaCallback({ audioRequested: true }, callback, {
            audio,
            askApp,
            wayland: true,
            watchPortal: noPick,
        })({
            video: window,
        });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video: window }));
        expect(audio.start).not.toHaveBeenCalled();
        expect(audio.stop).toHaveBeenCalled();
    });

    it("hands Windows 11 Chromium's loopback device without our own audio for a screen", async () => {
        setPlatform("win32");
        const audio = { start: vi.fn() } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, { audio, wayland: false })({ video });
        await vi.waitFor(() =>
            expect(callback).toHaveBeenCalledWith({ video, audio: WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO }),
        );
        expect(audio.start).not.toHaveBeenCalled();
    });

    it("hands Windows 11 the shared window's application loopback", async () => {
        setPlatform("win32");
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, { findApp: async () => 4321 })({ video: window });
        await vi.waitFor(() =>
            expect(callback).toHaveBeenCalledWith({ video: window, audio: windowsApplicationLoopback(4321) }),
        );
        expect(windowsApplicationLoopback(4321).id).toBe("applicationLoopback:4321");
    });

    it("shares no audio with Element's own window on Windows", async () => {
        setPlatform("win32");
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, { findApp: async () => process.pid })({
            video: window,
        });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video: window }));
    });

    it("leaves a cancelled Windows share without audio", () => {
        setPlatform("win32");
        const callback = vi.fn();
        const cancelled = { video: { id: "", name: "" } };
        wrapDisplayMediaCallback({ audioRequested: true }, callback)(cancelled);
        expect(callback).toHaveBeenCalledWith(cancelled);
    });

    it("returns the callback unchanged on Windows 10", () => {
        setPlatform("win32");
        osRelease.mockReturnValueOnce("10.0.19045");
        const callback = vi.fn();
        expect(wrapDisplayMediaCallback({ audioRequested: true }, callback)).toBe(callback);
    });

    it.each([
        ["audio was not requested", false, "linux", true],
        ["the setting is off", true, "linux", false],
        ["the setting is off on Windows", true, "win32", false],
        ["the platform is macOS", true, "darwin", true],
    ])("returns the callback unchanged when %s", (_, audioRequested, platform, enabled) => {
        setPlatform(platform);
        mockStore.get.mockReturnValue(enabled);
        const callback = vi.fn();
        expect(wrapDisplayMediaCallback({ audioRequested }, callback)).toBe(callback);
    });
});

describe("addScreenshareAudio", () => {
    function makeTrack() {
        return {
            stop: vi.fn<() => void>(),
            addEventListener: vi.fn<(type: "ended", listener: () => void) => void>(),
        };
    }
    type FakeTrack = ReturnType<typeof makeTrack>;
    interface FakeStream {
        getVideoTracks(): FakeTrack[];
        getAudioTracks(): FakeTrack[];
        addTrack: ReturnType<typeof vi.fn<(track: FakeTrack) => void>>;
    }
    function makeStream(videoTracks: FakeTrack[], audioTracks: FakeTrack[] = []): FakeStream {
        return {
            getVideoTracks: () => videoTracks,
            getAudioTracks: () => audioTracks,
            addTrack: vi.fn((t: FakeTrack) => void audioTracks.push(t)),
        };
    }

    // The function receives a DOM MediaDevices in the page; a plain object stands in for it here.
    function makeMediaDevices(
        displayStream: FakeStream,
        devices = [{ kind: "audioinput", label: SOURCE_LABEL, deviceId: "d1" }],
    ) {
        const micTrack = makeTrack();
        return {
            micTrack,
            mediaDevices: {
                getDisplayMedia: vi.fn(async (_constraints?: { audio?: unknown }) => displayStream),
                getUserMedia: vi.fn(async (_constraints: unknown) => makeStream([], [micTrack])),
                enumerateDevices: vi.fn(async () => devices),
            },
        };
    }

    it("adds the virtual microphone to a share that asked for audio", async () => {
        const videoTrack = makeTrack();
        const stream = makeStream([videoTrack]);
        const { mediaDevices, micTrack } = makeMediaDevices(stream);
        addScreenshareAudio(mediaDevices, SOURCE_LABEL);

        await expect(mediaDevices.getDisplayMedia({ audio: true })).resolves.toBe(stream);
        expect(stream.addTrack).toHaveBeenCalledWith(micTrack);
        expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
            audio: expect.objectContaining({ deviceId: { exact: "d1" }, echoCancellation: false }),
        });

        // Ending the share stops the audio too.
        videoTrack.addEventListener.mock.calls[0][1]();
        expect(micTrack.stop).toHaveBeenCalled();
    });

    it("leaves shares without audio, or that already have audio, alone", async () => {
        const stream = makeStream([makeTrack()], [makeTrack()]);
        const { mediaDevices } = makeMediaDevices(stream);
        addScreenshareAudio(mediaDevices, SOURCE_LABEL);

        await mediaDevices.getDisplayMedia({});
        await mediaDevices.getDisplayMedia({ audio: true });
        expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });

    it("returns the video-only stream if the device never appears", async () => {
        vi.useFakeTimers();
        const stream = makeStream([makeTrack()]);
        const { mediaDevices } = makeMediaDevices(stream, []);
        addScreenshareAudio(mediaDevices, SOURCE_LABEL);

        const result = mediaDevices.getDisplayMedia({ audio: true });
        await vi.advanceTimersByTimeAsync(5000);
        await expect(result).resolves.toBe(stream);
        expect(stream.addTrack).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it("wraps getDisplayMedia only once", () => {
        const { mediaDevices } = makeMediaDevices(makeStream([]));
        addScreenshareAudio(mediaDevices, SOURCE_LABEL);
        const wrapped = mediaDevices.getDisplayMedia;
        addScreenshareAudio(mediaDevices, SOURCE_LABEL);
        expect(mediaDevices.getDisplayMedia).toBe(wrapped);
    });
});

describe("parsePortalPick", () => {
    const windows = JSON.stringify({
        type: "method_return",
        payload: {
            type: "a{ta{sv}}",
            data: [
                {
                    "2838073011": {
                        "app-id": { type: "s", data: "window:102" },
                        "wm-class": { type: "s", data: "com.mojang.minecraft" },
                        "title": { type: "s", data: "Minecraft" },
                        "client-type": { type: "u", data: 0 },
                    },
                },
            ],
        },
    });
    const record = (member: string, id?: number): string =>
        JSON.stringify({
            type: "method_call",
            member,
            payload: { type: "a{sv}", data: [id ? { "window-id": { type: "t", data: id } } : {}] },
        });

    it("finds the picked window", () => {
        expect(parsePortalPick([windows, record("RecordWindow", 2838073011)])).toEqual({
            type: "window",
            window: { appId: "window:102", wmClass: "com.mojang.minecraft", title: "Minecraft", clientType: 0 },
        });
    });

    it("finds a picked screen, and nothing before a pick", () => {
        expect(parsePortalPick([windows, "not json", record("RecordMonitor")])).toEqual({ type: "monitor" });
        expect(parsePortalPick([windows])).toBeUndefined();
    });
});

describe("parseWaylandClients", () => {
    it("lists the peers of the compositor's sockets", () => {
        const ss = [
            "Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process",
            'u_str ESTAB 0 0 /run/user/1000/wayland-0 100 * 200 users:(("gnome-shell",pid=7,fd=3))',
            'u_str ESTAB 0 0 * 200 * 100 users:(("java",pid=42,fd=9))',
            'u_str ESTAB 0 0 /run/user/1000/bus 300 * 400 users:(("dbus",pid=8,fd=3))',
            'u_str ESTAB 0 0 * 400 * 300 users:(("other",pid=50,fd=4))',
        ].join("\n");
        expect(parseWaylandClients(ss, "wayland-0")).toEqual([42]);
    });
});

describe("resolveShellWindow", () => {
    const base: WindowLookup = {
        unitProcesses: () => undefined,
        x11WindowProcess: async () => undefined,
        waylandClients: async () => [],
        commandLine: () => "",
        isOwnProcess: (pid) => pid === 1,
        rootOf: (pid) => pid,
        isDescendant: () => false,
    };

    it("uses the unit of a window GNOME matched to a desktop file", async () => {
        const lookup = {
            ...base,
            unitProcesses: (id: string) => (id === "org.gnome.Console" ? [300, 301] : undefined),
            isDescendant: (pid: number, a: number) => pid === 301 && a === 300,
        };
        expect(await resolveShellWindow({ appId: "org.gnome.Console.desktop" }, lookup)).toEqual([300]);
    });

    it("uses _NET_WM_PID for an X11 window", async () => {
        const lookup = { ...base, x11WindowProcess: async (title: string) => (title === "Game" ? 77 : undefined) };
        expect(await resolveShellWindow({ appId: "window:5", title: "Game", clientType: 1 }, lookup)).toEqual([77]);
    });

    it("matches a Wayland client by the window class", async () => {
        const lookup = {
            ...base,
            waylandClients: async () => [10, 42, 1],
            commandLine: (pid: number) =>
                ({
                    10: "/usr/bin/prismlauncher",
                    42: "java -cp minecraft-26.3.jar net.minecraft.client.main.main",
                    1: "electron",
                })[pid] ?? "",
        };
        expect(await resolveShellWindow({ appId: "window:102", wmClass: "com.mojang.minecraft" }, lookup)).toEqual([
            42,
        ]);
    });

    it("recognises Element's own window", async () => {
        const lookup = {
            ...base,
            waylandClients: async () => [1],
            commandLine: () => "/usr/lib/electron /usr/lib/element/app.asar",
        };
        expect(await resolveShellWindow({ appId: "window:101", wmClass: "element" }, lookup)).toBe("own");
    });

    it("gives up when several clients match", async () => {
        const lookup = { ...base, waylandClients: async () => [10, 11], commandLine: () => "/usr/bin/foo" };
        expect(await resolveShellWindow({ appId: "window:3", wmClass: "foo" }, lookup)).toBeUndefined();
    });
});

describe("findX11WindowByTitle", () => {
    it("finds the window with that title", async () => {
        const runCommand = vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "-root") return "_NET_CLIENT_LIST(WINDOW): window id # 0x1, 0x2";
            return args[1] === "0x2"
                ? '_NET_WM_NAME(UTF8_STRING) = "Say \\"hi\\""\n_NET_WM_PID(CARDINAL) = 99'
                : '_NET_WM_NAME(UTF8_STRING) = "Other"\n_NET_WM_PID(CARDINAL) = 98';
        });
        expect(await findX11WindowByTitle('Say "hi"', runCommand)).toBe(99);
    });
});

describe("parseKdeRestoreData", () => {
    // What xdg-desktop-portal-kde 6.8 returned for a Konsole window picked in its dialog.
    const konsole =
        "000000040000000e006f0075007400700075007400730000000900000000000000000c0072006500670069006f006e00000013000000000000000000ffffffffffffffff00000016007600690072007400750061006c00530069007a0065000000150000000780000004380000000e00770069006e0064006f00770073000100000000000019514c6973743c57696e646f77526573746f7265496e666f3e00000000010000001e006f00720067002e006b00640065002e006b006f006e0073006f006c00650000001c0054006f006e0065002020140020004b006f006e0073006f006c0065";
    const bytes = (hex: string): number[] => [...Buffer.from(hex, "hex")];
    // The same data with no window and one output (the screen), or with a region instead.
    const noWindows = (hex: string): string =>
        hex.replace(/(514c6973743c57696e646f77526573746f7265496e666f3e00)00000001.*$/, "$100000000");
    const withOutputs = (hex: string): string => hex.replace("0000000900000000", "0000000900000001");
    const withRegion = (hex: string): string =>
        hex.replace("00000013000000000000000000ffffffffffffffff", "000000130000000000000000000000006300000063");

    it("reads a picked window", () => {
        expect(parseKdeRestoreData(bytes(konsole))).toEqual({
            type: "window",
            window: { appId: "org.kde.konsole.desktop", wmClass: "org.kde.konsole", title: "Tone \u2014 Konsole" },
        });
    });

    it("reads a picked screen or region", () => {
        expect(parseKdeRestoreData(bytes(withOutputs(noWindows(konsole))))).toEqual({ type: "monitor" });
        expect(parseKdeRestoreData(bytes(withRegion(noWindows(konsole))))).toEqual({ type: "monitor" });
    });

    it("gives up when nothing it knows was picked, or on unknown data", () => {
        expect(parseKdeRestoreData(bytes(noWindows(konsole)))).toBeUndefined();
        expect(parseKdeRestoreData([1, 2, 3])).toBeUndefined();
    });

    it("is found in the portal's reply", () => {
        const reply = JSON.stringify({
            type: "method_return",
            payload: {
                type: "ua{sv}",
                data: [
                    0,
                    {
                        persist_mode: { type: "u", data: 1 },
                        restore_data: { type: "(suv)", data: ["KDE", 1, { type: "ay", data: bytes(konsole) }] },
                    },
                ],
            },
        });
        expect(parsePortalPick([reply])).toMatchObject({ type: "window", window: { wmClass: "org.kde.konsole" } });
    });
});
