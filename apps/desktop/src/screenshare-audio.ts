/*
Copyright 2026 5TN1rcZRS79VAEFuUCRB

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Screen-share audio on Linux and Windows 11.
 *
 * Windows: Chromium can record the system mix minus everything our own processes play ("loopbackWithoutChrome",
 * Windows process loopback in exclude mode, Windows 11 and later), so we just hand that device back to Electron.
 *
 * Linux: Electron can only add audio to a getDisplayMedia() stream with `audio: "loopback"`, which on Linux records the
 * monitor of the default output device. That includes the call itself, so everyone on the call hears themselves.
 *
 * Instead, while a share with audio is running, we start a PipeWire loopback that exposes a virtual microphone fed
 * by every application's playback except our own. A script added to each frame then attaches that microphone to the
 * stream getDisplayMedia() returns, so Element Call publishes it as the screen share's audio. The loopback stops
 * once nothing records from it any more, or when Element exits.
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
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
 * Work out which playback ports still need linking into the mix, and whether the loopback is still wanted.
 *
 * @param objects - the output of `pw-dump`.
 * @param isOwnStream - whether a stream belongs to Element, given its `application.process.id`. Our own playback
 *   (the other people on the call) must never be shared back to them.
 * @param stopIfUnused - whether to stop when nothing records from the source.
 */
export function planLinks(
    objects: PipeWireObject[],
    isOwnStream: (pid: number) => boolean,
    stopIfUnused: boolean,
): LinkPlan {
    const nodes = new Map<number, Record<string, unknown>>();
    for (const o of objects) {
        if (o.type === "PipeWire:Interface:Node") nodes.set(o.id, o.info?.props ?? {});
    }
    const nodeId = (name: string): number | undefined =>
        [...nodes].find(([, props]) => props["node.name"] === name)?.[0];
    const mix = nodeId(MIX_NODE_NAME);
    const source = nodeId(SOURCE_NODE_NAME);
    if (mix === undefined || source === undefined) return { keepRunning: false, inUse: false, links: [] };

    const links = objects.filter((o) => o.type === "PipeWire:Interface:Link").map((o) => o.info ?? {});
    const inUse = links.some((l) => l["output-node-id"] === source);
    if (!inUse && stopIfUnused) return { keepRunning: false, inUse, links: [] };

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
        const node = nodes.get(props["node.id"] as number);
        if (node?.["media.class"] !== "Stream/Output/Audio") continue;
        // Loopback and filter streams (EasyEffects, module-loopback, ...) replay audio that we already take directly
        // from the application, so linking them as well would double it.
        if (node["node.link-group"]) continue;
        if (isOwnStream(Number(node["application.process.id"]))) continue;
        for (const channel of mixChannelsFor(props["audio.channel"])) {
            const input = mixInputs.get(channel);
            if (input !== undefined && !existing.has(`${port.id}:${input}`)) wanted.push([port.id, input]);
        }
    }
    return { keepRunning: true, inUse, links: wanted };
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

function run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) =>
            err ? reject(err) : resolve(stdout),
        );
    });
}

/** Runs the PipeWire loopback while a screen share needs it. */
export class ScreenshareAudio {
    private process: ChildProcess | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private startedAt = 0;
    private everUsed = false;
    private polling = false;

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
     */
    public async start(): Promise<boolean> {
        this.startedAt = Date.now();
        this.everUsed = false;
        if (this.process) return true;

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
            const ownPids = new Map<number, boolean>();
            const isOwn = (pid: number): boolean => {
                if (!ownPids.has(pid)) ownPids.set(pid, isDescendantOf(pid, process.pid));
                return ownPids.get(pid)!;
            };
            const plan = planLinks(objects, isOwn, stopIfUnused);
            if (plan.inUse) this.everUsed = true;
            if (!plan.keepRunning) {
                this.stop();
                return;
            }
            // A link can fail if the stream went away in the meantime; the next poll sorts that out.
            await Promise.all(
                plan.links.map(([output, input]) =>
                    this.runCommand("pw-link", [String(output), String(input)]).catch(() => {}),
                ),
            );
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
 * Wrap a display-media request callback so that, when the page asked for audio and a source was picked, the share
 * gets system audio. On Windows that is Chromium's loopback device. On Linux the PipeWire loopback is started before
 * the video is handed back, and the audio is attached in the renderer by {@link addScreenshareAudio}.
 */
export function wrapDisplayMediaCallback(
    request: { audioRequested: boolean },
    callback: (streams: Streams) => void,
    audio: ScreenshareAudio = screenshareAudio,
): (streams: Streams) => void {
    if (!request.audioRequested || !isScreenshareAudioEnabled()) return callback;
    return (streams) => {
        // An empty id means the user cancelled the picker. (A WebFrameMain source is never passed by our handler.)
        const video = streams.video;
        if (!video || !("id" in video) || !video.id) {
            callback(streams);
            return;
        }
        if (process.platform === "win32") {
            // Electron's types only list "loopback" and "loopbackWithMute", but it also accepts any {id, name}
            // audio device (the "escape hatch" in ElectronBrowserContext::DisplayMediaDeviceChosen).
            callback({ ...streams, audio: WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO as unknown as Streams["audio"] });
            return;
        }
        void audio
            .start()
            .catch((err) => console.error("Screen share audio: failed to start", err))
            .finally(() => callback(streams));
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
