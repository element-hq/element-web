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
 * owns the window. Where we cannot tell which application that is (on Wayland the portal does not say), we fall back
 * to every application except Element.
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
import { readFileSync, readlinkSync } from "node:fs";
import { release } from "node:os";
import { type Streams, type WebContents, webFrameMain } from "electron";

import Store from "./store.js";

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
    // PulseAudio clients carry their process id on the stream. Native PipeWire clients only on their client object.
    // (Not "pipewire.sec.pid": for PulseAudio clients that is the pipewire-pulse server.)
    const processId = (node: Record<string, unknown>): number =>
        Number(node["application.process.id"] ?? clients.get(node["client.id"] as number)?.["application.process.id"]);
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
export type AudioScope = { apps: "all" } | { apps: "one"; pid: number } | { apps: "none" };

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
    return { apps: "one", pid };
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

/** The main process of the application owning a Windows window. */
export async function findWindowsWindowApp(
    handle: number,
    runCommand: (command: string, args: string[], env: Record<string, string>) => Promise<string> = run,
): Promise<number | undefined> {
    const output = await runCommand(
        "powershell.exe",
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
    private app: number | undefined;

    public constructor(
        private readonly runCommand: (command: string, args: string[]) => Promise<string> = run,
        private readonly spawnLoopback: (args: string[]) => ChildProcess = (args) =>
            spawn("sh", args, { stdio: ["pipe", "ignore", "inherit"] }),
    ) {}

    public get running(): boolean {
        return this.process !== null;
    }

    /**
     * Start the loopback, or keep the running one for a new share. Resolves once the virtual microphone exists, with
     * false if PipeWire is unavailable.
     *
     * @param app - the main process id of the only application to share, or undefined for all except Element.
     */
    public async start(app?: number): Promise<boolean> {
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
                    decided.set(pid, !own && (app === undefined || isDescendantOf(pid, app)));
                }
                return decided.get(pid)!;
            };
            const plan = planLinks(objects, shouldShare, stopIfUnused);
            if (plan.inUse) this.everUsed = true;
            if (!plan.keepRunning) {
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

function findWindowApp(handle: number): Promise<number | undefined> {
    return process.platform === "win32" ? findWindowsWindowApp(handle) : findX11WindowApp(handle);
}

function isOwnProcess(pid: number): boolean {
    return pid === process.pid || (process.platform === "linux" && isDescendantOf(pid, process.pid));
}

/**
 * Wrap a display-media request callback so that, when the page asked for audio and a source was picked, the share
 * gets the audio of the shared window's application, or of every application except Element for a whole screen. On
 * Windows that is one of Chromium's loopback devices. On Linux the PipeWire loopback is started before the video is
 * handed back, and the audio is attached in the renderer by {@link addScreenshareAudio}.
 */
export function wrapDisplayMediaCallback(
    request: { audioRequested: boolean },
    callback: (streams: Streams) => void,
    audio: ScreenshareAudio = screenshareAudio,
    findApp: (handle: number) => Promise<number | undefined> = findWindowApp,
): (streams: Streams) => void {
    if (!request.audioRequested || !isScreenshareAudioEnabled()) return callback;
    return (streams) => {
        // An empty id means the user cancelled the picker. (A WebFrameMain source is never passed by our handler.)
        const video = streams.video;
        if (!video || !("id" in video) || !video.id) {
            callback(streams);
            return;
        }
        void (async (): Promise<void> => {
            const scope = await audioScopeFor(video.id, findApp, isOwnProcess).catch((): AudioScope => ({
                apps: "all",
            }));
            if (process.platform === "win32") {
                if (scope.apps === "none") return callback(streams);
                const device =
                    scope.apps === "one" ? windowsApplicationLoopback(scope.pid) : WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO;
                // Electron's types only list "loopback" and "loopbackWithMute", but it also accepts any {id, name}
                // audio device (the "escape hatch" in ElectronBrowserContext::DisplayMediaDeviceChosen).
                return callback({ ...streams, audio: device as unknown as Streams["audio"] });
            }
            try {
                // Sharing Element's own window: no audio, and no leftover loopback for the renderer to pick up.
                if (scope.apps === "none") audio.stop();
                else await audio.start(scope.apps === "one" ? scope.pid : undefined);
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
            if (!deviceId) return stream;
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
