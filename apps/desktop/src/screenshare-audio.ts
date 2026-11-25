/*
Copyright 2026 5TN1rcZRS79VAEFuUCRB

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Screen-share audio on Linux and Windows 11.
 *
 * Sharing a whole screen shares the audio of every application except Element itself (Element plays the call, so
 * sharing it would echo everyone back to themselves). Sharing a window shares only the audio of the application that
 * owns the window. On Wayland the portal does not say what was picked. On GNOME and KDE we learn it from the session
 * bus (see {@link PortalPickWatcher}); elsewhere, or when the window's application cannot be found, we ask which
 * application's audio to share.
 *
 * Windows: Chromium has loopback devices built on Windows process loopback (Windows 11 and later):
 * "loopbackWithoutChrome" records everything except our own process tree, and "applicationLoopback:<pid>" records
 * only the given process tree. We hand the right one back to Electron.
 *
 * Linux: Electron can only add audio to a getDisplayMedia() stream with `audio: "loopback"`, which on Linux records the
 * monitor of the default output device. That includes the call itself, so everyone on the call hears themselves.
 *
 * Instead, while a share with audio is running, we start a PipeWire loopback that exposes a virtual microphone fed
 * by the playback of the shared applications. A script added to each frame then attaches that microphone to the
 * stream getDisplayMedia() returns, so Element Call publishes it as the screen share's audio. The loopback stops
 * once nothing records from it any more, or when Element exits.
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { homedir, release } from "node:os";
import path from "node:path";
import { type BrowserWindow, dialog, type Streams, type WebContents, webFrameMain } from "electron";

import Store from "./store.js";
import { _t } from "./language-helper.js";
import { getConfig } from "./config.js";

/** PipeWire node that collects the applications' playback. */
export const MIX_NODE_NAME = "element-screenshare-mix";
/** PipeWire node that the renderer records from. */
export const SOURCE_NODE_NAME = "element-screenshare-audio";
/** Description of {@link SOURCE_NODE_NAME}, shown as the device label in the renderer. */
export const SOURCE_LABEL = "Element screen share audio";

const POLL_INTERVAL_MS = 1000;
const START_TIMEOUT_MS = 3000;
// How long to keep the loopback if the renderer never starts recording from it.
const UNUSED_TIMEOUT_MS = 20000;

/** The parts of a `pw-dump` object that we read. */
export interface PipeWireObject {
    id: number;
    type: string;
    info?: {
        "direction"?: string;
        "props"?: Record<string, unknown>;
        "output-node-id"?: number;
        "output-port-id"?: number;
        "input-node-id"?: number;
        "input-port-id"?: number;
    };
}

/** What a poll of the PipeWire graph decided. */
export interface LinkPlan {
    /** False if our nodes are gone, or nothing records from the source any more. */
    keepRunning: boolean;
    /** Whether the renderer is recording from the source. */
    inUse: boolean;
    /** [output port id, input port id] pairs to connect. */
    links: [number, number][];
    /** Ids of links into the mix from streams that should no longer be shared. */
    unlinks: number[];
}

/**
 * The mix channels a playback port with the given channel position should feed. The mix is stereo: left channels go
 * left, right channels go right, mono and centre go to both, and the subwoofer channel is dropped.
 */
export function mixChannelsFor(channel: unknown): string[] {
    if (typeof channel !== "string" || channel === "MONO" || channel === "FC" || channel === "UNK") return ["FL", "FR"];
    if (channel === "LFE") return [];
    if (channel.endsWith("L")) return ["FL"];
    if (channel.endsWith("R")) return ["FR"];
    return ["FL", "FR"];
}

/**
 * The process id of a stream. PulseAudio clients carry it on the stream, native PipeWire clients only on their client
 * object. (Not "pipewire.sec.pid": for PulseAudio clients that is the pipewire-pulse server.)
 */
function streamProcessId(node: Record<string, unknown>, clients: Map<number, Record<string, unknown>>): number {
    return Number(node["application.process.id"] ?? clients.get(Number(node["client.id"]))?.["application.process.id"]);
}

/** An application the user can choose to share the audio of. */
export interface AudioApp {
    /** Its main processes. Its audio is whatever these and their descendants play. */
    pids: number[];
    name: string;
    /** Whether it is playing audio right now. */
    playing: boolean;
}

/**
 * The applications with playback streams, other than Element and filter streams, one entry per main process.
 *
 * @param objects - the output of `pw-dump`.
 * @param isOwnProcess - whether a process belongs to Element.
 * @param rootOf - the main process of the application a process belongs to.
 */
export function listAudioApps(
    objects: PipeWireObject[],
    isOwnProcess: (pid: number) => boolean,
    rootOf: (pid: number) => number,
): AudioApp[] {
    const clients = new Map<number, Record<string, unknown>>();
    for (const o of objects) {
        if (o.type === "PipeWire:Interface:Client") clients.set(o.id, o.info?.props ?? {});
    }
    const apps = new Map<number, string>();
    for (const o of objects) {
        const node = o.info?.props ?? {};
        if (o.type !== "PipeWire:Interface:Node" || node["media.class"] !== "Stream/Output/Audio") continue;
        if (node["node.link-group"]) continue;
        const pid = streamProcessId(node, clients);
        if (!pid || isOwnProcess(pid)) continue;
        const root = rootOf(pid);
        if (apps.has(root)) continue;
        const client = clients.get(Number(node["client.id"])) ?? {};
        const name =
            node["application.name"] ??
            client["application.name"] ??
            node["application.process.binary"] ??
            node["node.name"];
        apps.set(root, typeof name === "string" && name ? name : String(root));
    }
    return [...apps].map(([pid, name]) => ({ pids: [pid], name, playing: true }));
}

/**
 * The application id in a process's cgroup, from the systemd unit desktops start applications in
 * ("app[-<launcher>]-<id>-<random>.scope", "app[-<launcher>]-<id>[@<random>].service", or for D-Bus activated
 * applications "app-dbus-:<bus>-<id>.slice"). Undefined for processes outside such a unit.
 */
export function appIdFromCgroup(cgroup: string): string | undefined {
    const unit = /\/app\.slice\/([^/\n]+)/.exec(cgroup)?.[1];
    if (!unit) return undefined;
    // Dashes inside the id are escaped as \x2d, so the dashes left separate the parts.
    const unescape = (text: string): string =>
        text.replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    const dbus = /^app-dbus-:[\d.]+-(.+)\.slice$/.exec(unescape(unit));
    if (dbus) return dbus[1];
    const rest = /^app-(.+?)(?:-[^-]+\.scope|@[^@]*\.service|\.service)$/.exec(unit)?.[1];
    const parts = rest?.split("-") ?? [];
    if (parts.length === 1 || parts.length === 2) return unescape(parts[parts.length - 1]);
    return undefined;
}

/** The directories holding .desktop files, in lookup order. */
function applicationDirs(): string[] {
    const home = process.env.XDG_DATA_HOME || path.join(homedir(), ".local/share");
    const dirs = (process.env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":").filter(Boolean);
    return [home, ...dirs].map((dir) => path.join(dir, "applications"));
}

/**
 * The name of the application with the given id from its .desktop file, or undefined if it has none or hides
 * itself (background services, autostart helpers).
 */
export function desktopEntryName(
    appId: string,
    dirs: string[] = applicationDirs(),
    readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): string | undefined {
    for (const dir of dirs) {
        let text: string;
        try {
            text = readFile(path.join(dir, `${appId}.desktop`));
        } catch {
            continue;
        }
        const entry = /^\[Desktop Entry\]$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(text)?.[1] ?? "";
        const key = (name: string): string | undefined => new RegExp(`^${name}=(.*)$`, "m").exec(entry)?.[1].trim();
        if (key("NoDisplay") === "true" || key("Hidden") === "true") return undefined;
        return key("Name") || undefined;
    }
    return undefined;
}

/**
 * The processes of each desktop application unit, by application id.
 *
 * @param pids - the running processes.
 * @param readCgroup - a process's cgroup.
 */
export function appUnits(pids: number[], readCgroup: (pid: number) => string): Map<string, number[]> {
    const byId = new Map<string, number[]>();
    for (const pid of pids) {
        let appId: string | undefined;
        try {
            appId = appIdFromCgroup(readCgroup(pid));
        } catch {
            continue;
        }
        if (appId) byId.set(appId, [...(byId.get(appId) ?? []), pid]);
    }
    return byId;
}

/** The topmost of the given processes' application roots. */
function topmostRoots(
    members: number[],
    rootOf: (pid: number) => number,
    isDescendant: (pid: number, ancestor: number) => boolean,
): number[] {
    const roots = [...new Set(members.map(rootOf))];
    return roots.filter((pid) => !roots.some((other) => other !== pid && isDescendant(pid, other)));
}

/**
 * The applications running in desktop application units, whether or not they play audio now, without Element.
 *
 * @param pids - the running processes.
 * @param readCgroup - a process's cgroup.
 * @param isOwnProcess - whether a process belongs to Element.
 * @param rootOf - the main process of the application a process belongs to.
 * @param nameOf - an application's display name, or undefined to leave it out.
 * @param isDescendant - whether a process is (a descendant of) another.
 */
export function listRunningApps(
    pids: number[],
    readCgroup: (pid: number) => string,
    isOwnProcess: (pid: number) => boolean,
    rootOf: (pid: number) => number,
    nameOf: (appId: string) => string | undefined,
    isDescendant: (pid: number, ancestor: number) => boolean,
): AudioApp[] {
    const apps: AudioApp[] = [];
    for (const [appId, members] of appUnits(pids, readCgroup)) {
        if (members.some(isOwnProcess)) continue;
        const name = nameOf(appId);
        if (!name) continue;
        // Keep only the topmost processes: a terminal's unit also holds everything started from it, which are
        // descendants of the terminal anyway and shown on their own once they play.
        apps.push({ pids: topmostRoots(members, rootOf, isDescendant), name, playing: false });
    }
    return apps;
}

/**
 * Combine the running applications with the ones playing audio: playing first, then by name. A playing application
 * that is one of the running ones is shown once, marked as playing. (One started from a terminal is its own entry.)
 */
export function mergeAudioApps(running: AudioApp[], playing: AudioApp[]): AudioApp[] {
    const apps = running.map((app) => ({ ...app }));
    for (const app of playing) {
        const owner = apps.find((r) => app.pids.some((pid) => r.pids.includes(pid)));
        if (owner) owner.playing = true;
        else apps.push({ ...app });
    }
    apps.sort((a, b) => Number(b.playing) - Number(a.playing) || a.name.localeCompare(b.name));
    // Two instances of the same application: tell them apart by process id.
    return apps.map((app) =>
        apps.some((other) => other !== app && other.name === app.name)
            ? { ...app, name: `${app.name} (${app.pids[0]})` }
            : app,
    );
}

/** A window as GNOME Shell describes it to the screen-cast portal. */
export interface ShellWindow {
    /** The desktop file id ("org.gnome.Console.desktop"), or "window:<n>" if GNOME could not match one. */
    appId?: string;
    /** On Wayland the client's app_id, on X11 its WM_CLASS. */
    wmClass?: string;
    title?: string;
    /** 0 for Wayland clients, 1 for X11 (XWayland) clients. */
    clientType?: number;
}

/** What the user picked in GNOME's screen-cast dialog. */
export type PortalPick = { type: "monitor" } | { type: "window"; window?: ShellWindow };

/** A D-Bus variant in `busctl --json` output. */
type BusValue = { type?: string; data?: unknown };

/**
 * Read what KDE's portal (xdg-desktop-portal-kde) says it shares, from the restore data it returns for every share:
 * a Qt QDataStream map of "outputs" (screens, including a virtual one), "region", "virtualSize" and "windows" (each
 * window's app id and title). Data this does not understand gives undefined.
 */
export function parseKdeRestoreData(bytes: number[]): PortalPick | undefined {
    const data = Buffer.from(bytes);
    // Find a map key (a QString: byte length, then UTF-16BE) and return the offset of its QVariant value.
    const valueAfterKey = (key: string): number | undefined => {
        const encoded = Buffer.alloc(4 + key.length * 2);
        encoded.writeUInt32BE(key.length * 2, 0);
        for (let i = 0; i < key.length; i++) encoded.writeUInt16BE(key.charCodeAt(i), 4 + i * 2);
        const at = data.indexOf(encoded);
        return at < 0 ? undefined : at + encoded.length;
    };
    const readString = (offset: number): [string, number] => {
        const length = data.readUInt32BE(offset);
        if (length === 0xffffffff) return ["", offset + 4];
        const chars: number[] = [];
        for (let i = 0; i < length; i += 2) chars.push(data.readUInt16BE(offset + 4 + i));
        return [String.fromCharCode(...chars), offset + 4 + length];
    };
    try {
        const windowsAt = valueAfterKey("windows");
        if (windowsAt !== undefined) {
            // A user type: type id, null flag, type name (QByteArray), then the list: count, then app id and title.
            let offset = windowsAt + 5;
            offset += 4 + data.readUInt32BE(offset);
            const count = data.readUInt32BE(offset);
            if (count > 0) {
                const [appId, afterAppId] = readString(offset + 4);
                const [title] = readString(afterAppId);
                return {
                    type: "window",
                    window: { appId: appId ? `${appId}.desktop` : undefined, wmClass: appId, title },
                };
            }
        }
        // A list: type id, null flag, count.
        const outputsAt = valueAfterKey("outputs");
        if (outputsAt !== undefined && data.readUInt32BE(outputsAt + 5) > 0) return { type: "monitor" };
        // A rectangle: type id, null flag, then left, top, right, bottom; a null one is (0, 0, -1, -1).
        const regionAt = valueAfterKey("region");
        if (regionAt !== undefined && data.readInt32BE(regionAt + 13) >= data.readInt32BE(regionAt + 5)) {
            return { type: "monitor" };
        }
    } catch {
        // Truncated or a different layout.
    }
    return undefined;
}

/**
 * Read the screen-cast portal from `busctl monitor --json=short` lines. On GNOME: the window list GNOME Shell hands it
 * (org.gnome.Shell.Introspect.GetWindows) and what it asks mutter to record (RecordMonitor or RecordWindow). On KDE:
 * the restore data xdg-desktop-portal-kde returns from Start. The last pick wins.
 */
export function parsePortalPick(lines: string[]): PortalPick | undefined {
    const windows = new Map<string, ShellWindow>();
    let pick: PortalPick | undefined;
    for (const line of lines) {
        let message: { member?: string; payload?: { type?: string; data?: unknown[] } };
        try {
            message = JSON.parse(line);
        } catch {
            continue;
        }
        const payload = message.payload;
        if (payload?.type === "a{ta{sv}}") {
            const list = (payload.data?.[0] ?? {}) as Record<string, Record<string, BusValue>>;
            for (const [id, props] of Object.entries(list)) {
                const value = (key: string): unknown => props[key]?.data;
                windows.set(id, {
                    appId: typeof value("app-id") === "string" ? (value("app-id") as string) : undefined,
                    wmClass: typeof value("wm-class") === "string" ? (value("wm-class") as string) : undefined,
                    title: typeof value("title") === "string" ? (value("title") as string) : undefined,
                    clientType: typeof value("client-type") === "number" ? (value("client-type") as number) : undefined,
                });
            }
        } else if (payload?.type === "ua{sv}") {
            const results = (payload.data?.[1] ?? {}) as Record<string, BusValue>;
            const restore = results.restore_data?.data as [string, number, BusValue] | undefined;
            if (restore?.[0] === "KDE" && Array.isArray(restore[2]?.data)) {
                pick = parseKdeRestoreData(restore[2].data as number[]) ?? pick;
            }
        } else if (message.member === "RecordMonitor") {
            pick = { type: "monitor" };
        } else if (message.member === "RecordWindow") {
            const props = (payload?.data?.[0] ?? {}) as Record<string, BusValue>;
            pick = { type: "window", window: windows.get(String(props["window-id"]?.data)) };
        }
    }
    return pick;
}

/**
 * Watches the session bus while the portal picker is open, to learn what the user picked. Read only, limited to
 * mutter's screen-cast calls and the replies of GNOME Shell and KDE's portal, and stopped as soon as the share starts.
 */
export class PortalPickWatcher {
    private readonly lines: string[] = [];
    private child: ChildProcess | null;

    public constructor(
        spawnMonitor: (args: string[]) => ChildProcess = (args) =>
            spawn("busctl", args, { stdio: ["ignore", "pipe", "ignore"] }),
    ) {
        let child: ChildProcess | null = null;
        try {
            child = spawnMonitor([
                "--user",
                "monitor",
                "--json=short",
                "--match",
                "type=method_call,interface=org.gnome.Mutter.ScreenCast.Session",
                "--match",
                "type=method_return,sender=org.gnome.Shell",
                "--match",
                "type=method_return,sender=org.freedesktop.impl.portal.desktop.kde",
            ]);
            child.on("error", () => this.stop());
            let pending = "";
            child.stdout?.on("data", (chunk: Buffer) => {
                const parts = (pending + chunk.toString()).split("\n");
                pending = parts.pop() ?? "";
                this.lines.push(
                    ...parts.filter(
                        (line) =>
                            line.includes("RecordMonitor") ||
                            line.includes("RecordWindow") ||
                            line.includes("a{ta{sv}}") ||
                            line.includes("restore_data"),
                    ),
                );
            });
        } catch {
            child = null;
        }
        this.child = child;
    }

    /** What was picked, waiting briefly for the monitor to catch up. Undefined if it cannot tell. */
    public async pick(waitMs = 1000): Promise<PortalPick | undefined> {
        const until = Date.now() + waitMs;
        let pick = parsePortalPick(this.lines);
        while (!pick && this.child && Date.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            pick = parsePortalPick(this.lines);
        }
        return pick;
    }

    public stop(): void {
        this.child?.kill();
        this.child = null;
    }
}

/**
 * The processes connected to a Wayland display, from `ss -xpn`: the peers of the compositor's sockets on it.
 *
 * @param ssOutput - the output of `ss -xpn`.
 * @param socketName - the display's socket ("wayland-0").
 */
export function parseWaylandClients(ssOutput: string, socketName: string): number[] {
    const processesByInode = new Map<string, string>();
    const peerInodes: string[] = [];
    for (const line of ssOutput.split("\n").slice(1)) {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 8) continue;
        const [, , , , local, localInode, , peerInode] = fields;
        processesByInode.set(localInode, fields.slice(8).join(" "));
        if (local.endsWith(`/${socketName}`)) peerInodes.push(peerInode);
    }
    const pids = new Set<number>();
    for (const inode of peerInodes) {
        for (const match of (processesByInode.get(inode) ?? "").matchAll(/pid=(\d+)/g)) pids.add(Number(match[1]));
    }
    return [...pids];
}

// Parts of a window class that say nothing about the application.
const GENERIC_CLASS_PARTS = new Set([
    "com",
    "org",
    "net",
    "io",
    "app",
    "de",
    "uk",
    "www",
    "desktop",
    "window",
    "github",
]);

/** The distinctive words of a window class ("com.mojang.minecraft" → ["mojang", "minecraft"]). */
export function windowClassWords(wmClass: string | undefined): string[] {
    return (wmClass ?? "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 3 && !GENERIC_CLASS_PARTS.has(word));
}

/** How {@link resolveShellWindow} looks things up. */
export interface WindowLookup {
    /** The processes of the desktop application unit with this id, if one runs. */
    unitProcesses(appId: string): number[] | undefined;
    /** The process of the X11 window with this title. */
    x11WindowProcess(title: string): Promise<number | undefined>;
    /** The processes connected to the Wayland display. */
    waylandClients(): Promise<number[]>;
    /** A process's command line, lower case. */
    commandLine(pid: number): string;
    isOwnProcess(pid: number): boolean;
    rootOf(pid: number): number;
    isDescendant(pid: number, ancestor: number): boolean;
}

/**
 * The main processes of the application owning a window GNOME Shell described, "own" if it is Element, or undefined
 * if it cannot be told:
 * 1. a window GNOME matched to a desktop file: that application's unit;
 * 2. an X11 window: its _NET_WM_PID, found by title;
 * 3. otherwise the one Wayland client whose command line has a distinctive word of the window class (Minecraft's
 *    "com.mojang.minecraft" is a java process started by its launcher).
 */
export async function resolveShellWindow(
    window: ShellWindow,
    lookup: WindowLookup,
): Promise<number[] | "own" | undefined> {
    const decide = (members: number[]): number[] | "own" | undefined => {
        if (members.length === 0) return undefined;
        if (members.some((pid) => lookup.isOwnProcess(pid))) return "own";
        return topmostRoots(
            members,
            (pid) => lookup.rootOf(pid),
            (pid, other) => lookup.isDescendant(pid, other),
        );
    };

    const desktopId = /^(.+)\.desktop$/.exec(window.appId ?? "")?.[1];
    if (desktopId) {
        const members = lookup.unitProcesses(desktopId);
        if (members?.length) return decide(members);
    }
    if ((window.clientType === undefined || window.clientType === 1) && window.title) {
        const pid = await lookup.x11WindowProcess(window.title).catch(() => undefined);
        if (pid) return decide([pid]);
    }
    const words = windowClassWords(window.wmClass);
    if (words.length > 0) {
        const clients = await lookup.waylandClients().catch((): number[] => []);
        const matches = clients.filter((pid) => {
            const commandLine = lookup.commandLine(pid);
            return words.some((word) => commandLine.includes(word));
        });
        const roots = decide(matches);
        if (roots === "own" || (roots && roots.length === 1)) return roots;
    }
    return undefined;
}

/** The process of the X11 window with this exact title, from the window manager's client list. */
export async function findX11WindowByTitle(
    title: string,
    runCommand: (command: string, args: string[]) => Promise<string> = run,
): Promise<number | undefined> {
    const list = await runCommand("xprop", ["-root", "_NET_CLIENT_LIST"]);
    for (const id of list.match(/0x[0-9a-f]+/gi) ?? []) {
        const props = await runCommand("xprop", ["-id", id, "_NET_WM_NAME", "_NET_WM_PID"]).catch(() => "");
        const name = /_NET_WM_NAME\([^)]*\) = "((?:[^"\\]|\\.)*)"/.exec(props)?.[1]?.replace(/\\(.)/g, "$1");
        const pid = Number(/_NET_WM_PID\(CARDINAL\) = (\d+)/.exec(props)?.[1]);
        if (name === title && pid) return pid;
    }
    return undefined;
}

/**
 * Work out which playback ports still need linking into the mix, which links should go, and whether the loopback is
 * still wanted.
 *
 * @param objects - the output of `pw-dump`.
 * @param shouldShare - whether to share a stream, given its `application.process.id`. Our own playback (the other
 *   people on the call) must never be shared back to them.
 * @param stopIfUnused - whether to stop when nothing records from the source.
 */
export function planLinks(
    objects: PipeWireObject[],
    shouldShare: (pid: number) => boolean,
    stopIfUnused: boolean,
): LinkPlan {
    const nodes = new Map<number, Record<string, unknown>>();
    const clients = new Map<number, Record<string, unknown>>();
    for (const o of objects) {
        if (o.type === "PipeWire:Interface:Node") nodes.set(o.id, o.info?.props ?? {});
        else if (o.type === "PipeWire:Interface:Client") clients.set(o.id, o.info?.props ?? {});
    }
    const processId = (node: Record<string, unknown>): number => streamProcessId(node, clients);
    const nodeId = (name: string): number | undefined =>
        [...nodes].find(([, props]) => props["node.name"] === name)?.[0];
    const mix = nodeId(MIX_NODE_NAME);
    const source = nodeId(SOURCE_NODE_NAME);
    if (mix === undefined || source === undefined) return { keepRunning: false, inUse: false, links: [], unlinks: [] };

    const linkObjects = objects.filter((o) => o.type === "PipeWire:Interface:Link");
    const links = linkObjects.map((o) => o.info ?? {});
    const inUse = links.some((l) => l["output-node-id"] === source);
    if (!inUse && stopIfUnused) return { keepRunning: false, inUse, links: [], unlinks: [] };

    const isShared = (node: Record<string, unknown> | undefined): boolean =>
        node?.["media.class"] === "Stream/Output/Audio" &&
        // Loopback and filter streams (EasyEffects, module-loopback, ...) replay audio that we already take directly
        // from the application, so linking them as well would double it.
        !node["node.link-group"] &&
        shouldShare(processId(node));

    const ports = objects.filter((o) => o.type === "PipeWire:Interface:Port");
    const mixInputs = new Map<unknown, number>();
    for (const port of ports) {
        const props = port.info?.props ?? {};
        if (props["node.id"] === mix && port.info?.direction === "input")
            mixInputs.set(props["audio.channel"], port.id);
    }

    const existing = new Set(links.map((l) => `${l["output-port-id"]}:${l["input-port-id"]}`));
    const wanted: [number, number][] = [];
    for (const port of ports) {
        const props = port.info?.props ?? {};
        if (port.info?.direction !== "output" || props["port.monitor"]) continue;
        if (!isShared(nodes.get(props["node.id"] as number))) continue;
        for (const channel of mixChannelsFor(props["audio.channel"])) {
            const input = mixInputs.get(channel);
            if (input !== undefined && !existing.has(`${port.id}:${input}`)) wanted.push([port.id, input]);
        }
    }
    // A share of another window, or a stream that changed hands: drop what should no longer be shared.
    const unlinks = linkObjects
        .filter((o) => o.info?.["input-node-id"] === mix && !isShared(nodes.get(Number(o.info?.["output-node-id"]))))
        .map((o) => o.id);
    return { keepRunning: true, inUse, links: wanted, unlinks };
}

/**
 * Which applications' audio a share includes: every application except Element, a single application given by its
 * main process id, or none (when the shared window is Element's own).
 */
export type AudioScope = { apps: "all" } | { apps: "one"; pids: number[] } | { apps: "none" };

/**
 * Parse a desktopCapturer source id ("screen:<id>:<n>" or "window:<handle>:<n>"). On Windows the handle is the HWND,
 * on X11 the X window id. On Wayland every portal pick is reported as a window whose handle is no window id at all.
 */
export function parseSourceId(id: string): { type: "screen" | "window"; handle: number } | null {
    const match = /^(screen|window):(\d+):/.exec(id);
    return match ? { type: match[1] as "screen" | "window", handle: Number(match[2]) } : null;
}

/**
 * Decide what a share of the given source includes.
 *
 * @param sourceId - the desktopCapturer source id that was picked.
 * @param findWindowApp - the main process id of the application owning a window, or undefined if unknown.
 * @param isOwnProcess - whether a process belongs to Element.
 */
export async function audioScopeFor(
    sourceId: string,
    findWindowApp: (handle: number) => Promise<number | undefined>,
    isOwnProcess: (pid: number) => boolean,
): Promise<AudioScope> {
    const source = parseSourceId(sourceId);
    if (source?.type !== "window") return { apps: "all" };
    const pid = await findWindowApp(source.handle).catch(() => undefined);
    if (!pid) return { apps: "all" };
    if (isOwnProcess(pid)) return { apps: "none" };
    return { apps: "one", pids: [pid] };
}

/**
 * Whether `pid` is `ancestor` or one of its descendants. Chromium plays audio from a child process, so the stream's
 * process id is not our own.
 */
export function isDescendantOf(
    pid: number,
    ancestor: number,
    readStat: (pid: number) => string = (p) => readFileSync(`/proc/${p}/stat`, "utf8"),
): boolean {
    for (let p = pid, depth = 0; p > 1 && depth < 64; depth++) {
        if (p === ancestor) return true;
        try {
            const stat = readStat(p);
            // The process name can contain spaces and brackets; the parent pid is the second field after it.
            p = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
        } catch {
            return false;
        }
    }
    return false;
}

function run(command: string, args: string[], env?: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            command,
            args,
            { maxBuffer: 64 * 1024 * 1024, timeout: 10000, windowsHide: true, env: env && { ...process.env, ...env } },
            (err, stdout) => (err ? reject(err) : resolve(stdout)),
        );
    });
}

/**
 * Walk up from `pid` while the parent runs the same executable, like Chromium does on Windows: a window can belong to
 * a child process of the application, which then plays its audio from somewhere else in the tree.
 */
export function appRootProcess(
    pid: number,
    readExe: (pid: number) => string,
    readParent: (pid: number) => number,
): number {
    let root = pid;
    for (let depth = 0; depth < 64; depth++) {
        try {
            const parent = readParent(root);
            if (parent <= 1 || readExe(parent) !== readExe(root)) break;
            root = parent;
        } catch {
            break;
        }
    }
    return root;
}

const linuxParent = (pid: number): number => {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
};

/** The main process of the application owning an X11 window, from its _NET_WM_PID. Undefined on Wayland. */
export async function findX11WindowApp(
    handle: number,
    runCommand: (command: string, args: string[]) => Promise<string> = run,
): Promise<number | undefined> {
    const output = await runCommand("xprop", ["-id", String(handle), "_NET_WM_PID"]);
    const pid = Number(/[=]\s*(\d+)/.exec(output)?.[1]);
    if (!pid) return undefined;
    return appRootProcess(pid, (p) => readlinkSync(`/proc/${p}/exe`), linuxParent);
}

// Mirrors Chromium's GetAppMainProcessId (desktop_capture_devices_util_win.cc): the window's process; for UWP apps
// (hosted by ApplicationFrameHost) the process of their CoreWindow; then up through parents running the same
// executable. The window handle comes in through the environment, so nothing is pasted into the script.
const WINDOWS_FIND_APP_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -Namespace ElementScreenshare -Name User32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string cls, string title);
'@
$hwnd = [IntPtr][int64]$env:ELEMENT_SCREENSHARE_HWND
$id = [uint32]0
[void][ElementScreenshare.User32]::GetWindowThreadProcessId($hwnd, [ref]$id)
$p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
if ($p.Name -eq 'ApplicationFrameHost.exe') {
    $core = [ElementScreenshare.User32]::FindWindowExW($hwnd, [IntPtr]::Zero, 'Windows.UI.Core.CoreWindow', $null)
    $id = [uint32]0
    if ($core -ne [IntPtr]::Zero) { [void][ElementScreenshare.User32]::GetWindowThreadProcessId($core, [ref]$id) }
    $id
    return
}
while ($p -and $p.ExecutablePath) {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)"
    if (-not $parent -or $parent.ExecutablePath -ne $p.ExecutablePath) { break }
    $p = $parent
}
$p.ProcessId
`;

/** PowerShell, by its full path so that nothing earlier on PATH can stand in for it. */
export function windowsPowerShell(systemRoot = process.env.SystemRoot || "C:\\Windows"): string {
    return path.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

/** The main process of the application owning a Windows window. */
export async function findWindowsWindowApp(
    handle: number,
    runCommand: (command: string, args: string[], env: Record<string, string>) => Promise<string> = run,
): Promise<number | undefined> {
    const output = await runCommand(
        windowsPowerShell(),
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_FIND_APP_SCRIPT],
        { ELEMENT_SCREENSHARE_HWND: String(handle) },
    );
    const pid = Number(output.trim().split(/\s+/).pop());
    return pid > 0 ? pid : undefined;
}

/** Runs the PipeWire loopback while a screen share needs it. */
export class ScreenshareAudio {
    private process: ChildProcess | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private startedAt = 0;
    private everUsed = false;
    private polling = false;
    private app: number[] | undefined;

    public constructor(
        private readonly runCommand: (command: string, args: string[]) => Promise<string> = run,
        private readonly spawnLoopback: (args: string[]) => ChildProcess = (args) =>
            spawn("/bin/sh", args, { stdio: ["pipe", "ignore", "inherit"] }),
    ) {}

    public get running(): boolean {
        return this.process !== null;
    }

    /**
     * Start the loopback, or keep the running one for a new share. Resolves once the virtual microphone exists, with
     * false if PipeWire is unavailable.
     *
     * @param app - the main processes of the only application to share, or undefined for all except Element.
     */
    public async start(app?: number[]): Promise<boolean> {
        this.startedAt = Date.now();
        this.everUsed = false;
        this.app = app;
        if (this.process) {
            await this.poll();
            return true;
        }

        const props = (mediaClass: string, name: string, description: string, extra: string): string =>
            `media.class=${mediaClass} node.name=${name} node.description="${description}" ${extra}`;
        // The shell ties pw-loopback's lifetime to ours: when we close its stdin (on stop(), or because Element exited
        // or crashed) `cat` returns and the loopback is killed.
        const script = 'pw-loopback "$@" & p=$!; cat >/dev/null; kill $p 2>/dev/null';
        const child = this.spawnLoopback([
            "-c",
            script,
            "sh",
            "--name",
            "element-screenshare",
            "--capture-props",
            props("Stream/Input/Audio", MIX_NODE_NAME, "Element screen share mix", "node.autoconnect=false"),
            "--playback-props",
            props("Audio/Source", SOURCE_NODE_NAME, SOURCE_LABEL, "priority.session=0 priority.driver=0"),
        ]);
        this.process = child;
        child.on("error", (err) => {
            console.error("Screen share audio: could not start pw-loopback", err);
            if (this.process === child) this.stop();
        });
        child.on("exit", () => {
            if (this.process === child) this.stop();
        });

        while (this.process === child && Date.now() - this.startedAt < START_TIMEOUT_MS) {
            const objects = await this.dump().catch(() => null);
            if (objects && planLinks(objects, () => true, false).keepRunning) {
                await this.poll(objects);
                this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        console.error("Screen share audio: the virtual microphone did not appear");
        this.stop();
        return false;
    }

    /** Stop the loopback. Its links disappear with it. */
    public stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        const child = this.process;
        this.process = null;
        child?.stdin?.end();
    }

    /** The running applications and the ones playing audio, for the user to choose from. */
    public async listApps(): Promise<AudioApp[]> {
        const rootOf = (pid: number): number => {
            try {
                return appRootProcess(pid, (p) => readlinkSync(`/proc/${p}/exe`), linuxParent);
            } catch {
                return pid;
            }
        };
        const isOwn = (pid: number): boolean => isDescendantOf(pid, process.pid);
        const playing = listAudioApps(await this.dump(), isOwn, rootOf);
        const pids = readdirSync("/proc")
            .filter((name) => /^\d+$/.test(name))
            .map(Number);
        const names = new Map<string, string | undefined>();
        const nameOf = (appId: string): string | undefined => {
            if (!names.has(appId)) names.set(appId, desktopEntryName(appId));
            return names.get(appId);
        };
        const running = listRunningApps(
            pids,
            (pid) => readFileSync(`/proc/${pid}/cgroup`, "utf8"),
            isOwn,
            rootOf,
            nameOf,
            (pid, root) => isDescendantOf(pid, root),
        );
        return mergeAudioApps(running, playing);
    }

    private async dump(): Promise<PipeWireObject[]> {
        return JSON.parse(await this.runCommand("pw-dump", [])) as PipeWireObject[];
    }

    /** Link new playback streams into the mix, and stop once the renderer stopped recording. */
    public async poll(objects?: PipeWireObject[]): Promise<void> {
        if (this.polling || !this.process) return;
        this.polling = true;
        try {
            objects ??= await this.dump();
            const stopIfUnused = this.everUsed || Date.now() - this.startedAt > UNUSED_TIMEOUT_MS;
            const app = this.app;
            const decided = new Map<number, boolean>();
            const shouldShare = (pid: number): boolean => {
                if (!decided.has(pid)) {
                    const own = isDescendantOf(pid, process.pid);
                    decided.set(pid, !own && (app === undefined || app.some((root) => isDescendantOf(pid, root))));
                }
                return decided.get(pid)!;
            };
            const plan = planLinks(objects, shouldShare, stopIfUnused);
            if (plan.inUse) this.everUsed = true;
            if (!plan.keepRunning) {
                console.log("Screen share audio: stopping,", plan.inUse ? "nodes gone" : "nothing records any more");
                this.stop();
                return;
            }
            // A link can fail if the stream went away in the meantime; the next poll sorts that out.
            await Promise.all([
                ...plan.unlinks.map((link) => this.runCommand("pw-link", ["-d", String(link)]).catch(() => {})),
                ...plan.links.map(([output, input]) =>
                    this.runCommand("pw-link", [String(output), String(input)]).catch(() => {}),
                ),
            ]);
        } catch (err) {
            console.error("Screen share audio: failed to update the PipeWire graph", err);
        } finally {
            this.polling = false;
        }
    }
}

const screenshareAudio = new ScreenshareAudio();

/**
 * Chromium's loopback device for the system mix without the browser's own audio. Electron only picks it by itself
 * when the page sets `restrictOwnAudio`, which Element Call does not, so we name it directly.
 */
export const WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO = { id: "loopbackWithoutChrome", name: "System audio" };

/** Chromium's loopback device for one application's process tree. */
export function windowsApplicationLoopback(pid: number): { id: string; name: string } {
    return { id: `applicationLoopback:${pid}`, name: "Application audio" };
}

// Windows 11 is version 10.0.22000. Chromium only supports leaving out its own audio from there on
// (media::IsWindowsProcessLoopbackCaptureSupported); older versions would capture the call too.
const WINDOWS_11_BUILD = 22000;

/** Whether this platform can share system audio without also sharing the call. */
export function isScreenshareAudioSupported(
    platform: string = process.platform,
    osRelease: string = release(),
): boolean {
    if (platform === "linux") return true;
    if (platform === "win32") return Number(osRelease.split(".")[2]) >= WINDOWS_11_BUILD;
    return false;
}

/** Whether system audio should be added to screen shares that ask for it. */
export function isScreenshareAudioEnabled(): boolean {
    return isScreenshareAudioSupported() && !!Store.instance?.get("shareSystemAudio");
}

/**
 * Ask which application's audio to share. Used on Wayland, where the portal does not tell us which window was picked.
 * Escape shares no audio.
 */
export async function askAudioScope(
    apps: AudioApp[],
    parent: BrowserWindow | null = global.mainWindow,
): Promise<AudioScope> {
    const brand = getConfig().brand;
    const buttons = [
        _t("screenshare_audio|all_apps", { brand }),
        ...apps.map((app) => (app.playing ? _t("screenshare_audio|playing", { name: app.name }) : app.name)),
        _t("screenshare_audio|no_audio"),
    ];
    const options = {
        type: "question" as const,
        title: _t("screenshare_audio|title"),
        message: _t("screenshare_audio|message"),
        detail: _t("screenshare_audio|detail", { brand }),
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
        noLink: true,
    };
    const { response } = await (parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options));
    if (response === 0) return { apps: "all" };
    const app = apps[response - 1];
    return app ? { apps: "one", pids: app.pids } : { apps: "none" };
}

/** Whether screen sharing goes through the xdg-desktop-portal picker, as electron-main.ts decides. */
function isWayland(): boolean {
    return process.env.XDG_SESSION_TYPE === "wayland";
}

function findWindowApp(handle: number): Promise<number | undefined> {
    return process.platform === "win32" ? findWindowsWindowApp(handle) : findX11WindowApp(handle);
}

function isOwnProcess(pid: number): boolean {
    return pid === process.pid || (process.platform === "linux" && isDescendantOf(pid, process.pid));
}

/** Looks up windows GNOME Shell described, on this machine. */
const systemWindowLookup = (): WindowLookup => {
    const pids = (): number[] =>
        readdirSync("/proc")
            .filter((name) => /^\d+$/.test(name))
            .map(Number);
    return {
        unitProcesses: (appId) => appUnits(pids(), (pid) => readFileSync(`/proc/${pid}/cgroup`, "utf8")).get(appId),
        x11WindowProcess: (title) => findX11WindowByTitle(title),
        waylandClients: async () =>
            parseWaylandClients(await run("ss", ["-xpn"]), process.env.WAYLAND_DISPLAY || "wayland-0"),
        commandLine: (pid) => {
            try {
                return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ").toLowerCase();
            } catch {
                return "";
            }
        },
        isOwnProcess,
        rootOf: (pid) => {
            try {
                return appRootProcess(pid, (p) => readlinkSync(`/proc/${p}/exe`), linuxParent);
            } catch {
                return pid;
            }
        },
        isDescendant: (pid, ancestor) => isDescendantOf(pid, ancestor),
    };
};

/**
 * What the portal pick means for audio: a whole screen shares all but Element, a window its application (none for
 * Element's own). Undefined when it cannot be told, e.g. on desktops other than GNOME.
 */
export async function scopeFromPortalPick(
    pick: PortalPick | undefined,
    lookup: WindowLookup,
): Promise<AudioScope | undefined> {
    if (!pick) return undefined;
    if (pick.type === "monitor") return { apps: "all" };
    if (!pick.window) return undefined;
    const pids = await resolveShellWindow(pick.window, lookup).catch(() => undefined);
    if (pids === "own") return { apps: "none" };
    return pids ? { apps: "one", pids } : undefined;
}

/** On Wayland: ask which application to share. With no other application running, share all but Element. */
async function waylandAudioScope(
    audio: ScreenshareAudio,
    askApp: (apps: AudioApp[]) => Promise<AudioScope>,
): Promise<AudioScope> {
    const apps = await audio.listApps().catch((): AudioApp[] => []);
    if (apps.length === 0) return { apps: "all" };
    return askApp(apps).catch((): AudioScope => ({ apps: "all" }));
}

/**
 * Wrap a display-media request callback so that, when the page asked for audio and a source was picked, the share
 * gets the audio of the shared window's application, or of every application except Element for a whole screen. On
 * Wayland the portal does not say what was picked: on GNOME and KDE it is read off the session bus ({@link PortalPickWatcher});
 * otherwise the user chooses the application (see {@link askAudioScope}).
 * On Windows that is one of Chromium's loopback devices. On Linux the PipeWire loopback is started before the video is
 * handed back, and the audio is attached in the renderer by {@link addScreenshareAudio}.
 */
export function wrapDisplayMediaCallback(
    request: { audioRequested: boolean },
    callback: (streams: Streams) => void,
    {
        audio = screenshareAudio,
        findApp = findWindowApp,
        askApp = askAudioScope,
        wayland = isWayland(),
        watchPortal = (): PortalPickWatcher => new PortalPickWatcher(),
        windowLookup = systemWindowLookup,
    }: {
        audio?: ScreenshareAudio;
        findApp?: (handle: number) => Promise<number | undefined>;
        askApp?: (apps: AudioApp[]) => Promise<AudioScope>;
        wayland?: boolean;
        watchPortal?: () => Pick<PortalPickWatcher, "pick" | "stop">;
        windowLookup?: () => WindowLookup;
    } = {},
): (streams: Streams) => void {
    if (!request.audioRequested || !isScreenshareAudioEnabled()) return callback;
    // On Wayland the portal picker opens right after this: watch it to learn what the user picks.
    const watcher = process.platform === "linux" && wayland ? watchPortal() : undefined;
    // Never leave the bus monitor running, e.g. if the picker is never answered.
    const watchTimeout = watcher ? setTimeout(() => watcher.stop(), 10 * 60 * 1000) : undefined;
    const stopWatching = (): void => {
        clearTimeout(watchTimeout);
        watcher?.stop();
    };
    return (streams) => {
        // An empty id means the user cancelled the picker. (A WebFrameMain source is never passed by our handler.)
        const video = streams.video;
        if (!video || !("id" in video) || !video.id) {
            stopWatching();
            callback(streams);
            return;
        }
        void (async (): Promise<void> => {
            let scope: AudioScope;
            if (process.platform === "linux" && wayland) {
                const pick = await watcher?.pick().catch(() => undefined);
                stopWatching();
                scope = (await scopeFromPortalPick(pick, windowLookup())) ?? (await waylandAudioScope(audio, askApp));
            } else {
                scope = await audioScopeFor(video.id, findApp, isOwnProcess).catch((): AudioScope => ({ apps: "all" }));
            }
            if (process.platform === "win32") {
                if (scope.apps === "none") return callback(streams);
                const device =
                    scope.apps === "one"
                        ? windowsApplicationLoopback(scope.pids[0])
                        : WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO;
                // Electron's types only list "loopback" and "loopbackWithMute", but it also accepts any {id, name}
                // audio device (the "escape hatch" in ElectronBrowserContext::DisplayMediaDeviceChosen).
                return callback({ ...streams, audio: device as unknown as Streams["audio"] });
            }
            console.log(
                "Screen share audio: sharing",
                scope.apps === "one" ? `processes ${scope.pids.join(", ")}` : scope.apps,
            );
            try {
                // Sharing Element's own window: no audio, and no leftover loopback for the renderer to pick up.
                if (scope.apps === "none") audio.stop();
                else await audio.start(scope.apps === "one" ? scope.pids : undefined);
            } catch (err) {
                console.error("Screen share audio: failed to start", err);
            }
            callback(streams);
        })();
    };
}

/** The parts of the DOM media API that {@link addScreenshareAudio} uses. */
interface PageTrack {
    stop(): void;
    addEventListener(type: "ended", listener: () => void): void;
}
interface PageStream {
    getVideoTracks(): PageTrack[];
    getAudioTracks(): PageTrack[];
    addTrack(track: PageTrack): void;
}
interface PageMediaDevices {
    getDisplayMedia(constraints?: { audio?: unknown }): Promise<PageStream>;
    getUserMedia(constraints: unknown): Promise<PageStream>;
    enumerateDevices(): Promise<{ kind: string; label: string; deviceId: string }[]>;
    /** Set once getDisplayMedia() has been wrapped. */
    elementScreenshareAudio?: boolean;
}

/**
 * Runs inside each frame, on its `navigator.mediaDevices` (it is serialised with toString(), so it must not use anything from outside its body).
 * Wraps getDisplayMedia() so that a stream which asked for audio, but came back without it, gets the virtual
 * microphone as its audio track.
 */
export function addScreenshareAudio(marked: PageMediaDevices | undefined, label: string): void {
    if (!marked || typeof marked.getDisplayMedia !== "function" || marked.elementScreenshareAudio) return;
    const getDisplayMedia = marked.getDisplayMedia.bind(marked);

    const findDevice = async (): Promise<string | null> => {
        // The main process creates the device just before getDisplayMedia() resolves; the device list can lag.
        for (let attempt = 0; attempt < 30; attempt++) {
            const devices = await marked.enumerateDevices();
            const device = devices.find((d) => d.kind === "audioinput" && d.label.includes(label));
            if (device) return device.deviceId;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return null;
    };

    const wrapped = async (constraints: { audio?: unknown } = {}): Promise<PageStream> => {
        const stream = await getDisplayMedia(constraints);
        const video = stream.getVideoTracks()[0];
        if (!constraints.audio || !video || stream.getAudioTracks().length > 0) return stream;
        try {
            const deviceId = await findDevice();
            if (!deviceId) {
                console.warn("Screen share audio: the virtual microphone did not show up");
                return stream;
            }
            const audio = await marked.getUserMedia({
                audio: {
                    deviceId: { exact: deviceId },
                    // This is not a microphone: leave the audio as the applications played it.
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2,
                },
            });
            const track = audio.getAudioTracks()[0];
            if (!track) return stream;
            stream.addTrack(track);
            video.addEventListener("ended", () => track.stop());
        } catch (err) {
            console.warn("Screen share audio is unavailable", err);
        }
        return stream;
    };

    Object.defineProperty(marked, "getDisplayMedia", { value: wrapped, configurable: true, writable: true });
    Object.defineProperty(marked, "elementScreenshareAudio", { value: true });
}

/**
 * Add {@link addScreenshareAudio} to every frame of `webContents` as it loads, while the setting is on. Element Call
 * runs in a widget iframe, which the preload script does not reach. Its frame is created for each call, so turning
 * the setting on takes effect from the next call.
 */
export function setupScreenshareAudio(webContents: WebContents): void {
    if (process.platform !== "linux") return;
    const script = `(${addScreenshareAudio.toString()})(navigator.mediaDevices, ${JSON.stringify(SOURCE_LABEL)});`;
    webContents.on("did-frame-finish-load", (_event, _isMainFrame, frameProcessId, frameRoutingId) => {
        if (!isScreenshareAudioEnabled()) return;
        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
        frame?.executeJavaScript(script).catch(() => {});
    });
}
