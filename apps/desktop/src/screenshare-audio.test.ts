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
    isDescendantOf,
    isScreenshareAudioSupported,
    MIX_NODE_NAME,
    mixChannelsFor,
    type PipeWireObject,
    planLinks,
    ScreenshareAudio,
    SOURCE_LABEL,
    SOURCE_NODE_NAME,
    WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO,
    wrapDisplayMediaCallback,
} from "./screenshare-audio.js";

const { mockStore, osRelease } = vi.hoisted(() => ({
    mockStore: { get: vi.fn<(key: string) => unknown>() },
    osRelease: vi.fn<() => string>(() => "10.0.22631"),
}));

vi.mock("node:os", () => ({ release: osRelease }));

vi.mock("electron", () => ({ webFrameMain: { fromId: vi.fn() } }));
vi.mock("./store.js", () => ({ default: { instance: mockStore } }));

const MIX = 10;
const SOURCE = 11;
const APP = 20;
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
function link(outputNode: number, outputPort: number, inputPort: number): PipeWireObject {
    return {
        id: 1000 + outputPort * 10 + inputPort,
        type: "PipeWire:Interface:Link",
        info: { "output-node-id": outputNode, "output-port-id": outputPort, "input-port-id": inputPort },
    };
}

/** A graph with our loopback, another app, Element's own playback and a filter stream. */
function graph(extra: PipeWireObject[] = []): PipeWireObject[] {
    return [
        node(MIX, { "node.name": MIX_NODE_NAME, "media.class": "Stream/Input/Audio" }),
        node(SOURCE, { "node.name": SOURCE_NODE_NAME, "media.class": "Audio/Source" }),
        node(APP, { "node.name": "firefox", "media.class": "Stream/Output/Audio", "application.process.id": 200 }),
        node(OWN, { "node.name": "element", "media.class": "Stream/Output/Audio", "application.process.id": 300 }),
        node(FILTER, { "node.name": "easyeffects", "media.class": "Stream/Output/Audio", "node.link-group": "g" }),
        node(RECORDER, { "node.name": "element-rec", "media.class": "Stream/Input/Audio" }),
        port(101, MIX, "input", "FL"),
        port(102, MIX, "input", "FR"),
        port(111, SOURCE, "output", "FL"),
        port(201, APP, "output", "FL"),
        port(202, APP, "output", "FR"),
        port(203, APP, "output", "FL", { "port.monitor": true }),
        port(301, OWN, "output", "FL"),
        port(401, FILTER, "output", "FL"),
        ...extra,
    ];
}

const isOwn = (pid: number): boolean => pid === 300;

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
        const plan = planLinks(graph(), isOwn, false);
        expect(plan.keepRunning).toBe(true);
        expect(plan.links).toEqual([
            [201, 101],
            [202, 102],
        ]);
    });

    it("skips links that already exist", () => {
        const plan = planLinks(graph([link(APP, 201, 101)]), isOwn, false);
        expect(plan.links).toEqual([[202, 102]]);
    });

    it("stops when the loopback nodes are gone", () => {
        const plan = planLinks(graph().slice(2), isOwn, false);
        expect(plan.keepRunning).toBe(false);
    });

    it("stops when nothing records from the source and stopping is allowed", () => {
        expect(planLinks(graph(), isOwn, true).keepRunning).toBe(false);
    });

    it("keeps running while the source is recorded", () => {
        const plan = planLinks(graph([link(SOURCE, 111, 999)]), isOwn, true);
        expect(plan).toMatchObject({ keepRunning: true, inUse: true });
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

    it("stops after the renderer stops recording", async () => {
        const audio = new ScreenshareAudio(runCommand, spawnLoopback);
        objects = graph([link(SOURCE, 111, 999)]);
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

describe("wrapDisplayMediaCallback", () => {
    const originalPlatform = process.platform;
    const setPlatform = (platform: string): void => {
        Object.defineProperty(process, "platform", { value: platform });
    };
    const video = { id: "screen:1", name: "Screen" };

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
        wrapDisplayMediaCallback({ audioRequested: true }, callback, audio)({ video });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video }));
        expect(audio.start).toHaveBeenCalled();
    });

    it("still hands back the source if the loopback fails", async () => {
        const audio = { start: vi.fn(async () => Promise.reject(new Error("no pipewire"))) };
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, audio as unknown as ScreenshareAudio)({ video });
        await vi.waitFor(() => expect(callback).toHaveBeenCalledWith({ video }));
    });

    it("does nothing when the picker was cancelled", () => {
        const audio = { start: vi.fn() } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, audio)({ video: { id: "", name: "" } });
        expect(callback).toHaveBeenCalled();
        expect(audio.start).not.toHaveBeenCalled();
    });

    it("hands Windows 11 Chromium's loopback device without our own audio", () => {
        setPlatform("win32");
        const audio = { start: vi.fn() } as unknown as ScreenshareAudio;
        const callback = vi.fn();
        wrapDisplayMediaCallback({ audioRequested: true }, callback, audio)({ video });
        expect(callback).toHaveBeenCalledWith({ video, audio: WINDOWS_LOOPBACK_WITHOUT_OWN_AUDIO });
        expect(audio.start).not.toHaveBeenCalled();
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
