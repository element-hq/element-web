/*
Copyright 2026 foxberries

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This file defines the renderer side of the Audiofox IPC API for audio source enumeration
// and capture. It ultimately enables the transmission of audio with a MediaStream returned
// by the Screen Capture API when running on a compatible platform (Electron + Audiofox).

import type { Audiofox, AudioManager, AudioSources, LinkHandle, SourceName } from "shared-types";
import audioWorkletFactory from "./audioWorkletFactory";

/**
 * Objects required for processing the audio received by Audiofox.
 */
interface AudioResources {
    /** The graph used by the audio processor and its output. */
    readonly audioContext: AudioContext;
    /** The audio processor, as imported by `AudioProcessorURL`. */
    readonly processor: AudioWorkletNode;
    /** The output of the audio processor, which is transmitted over WebRTC. */
    readonly output: MediaStreamAudioDestinationNode;
}

/**
 * Objects required for the duration of an active stream.
 */
interface StreamState extends AudioResources {
    /** IPC reference to the `LinkHandle` on the main thread. */
    readonly handle: LinkHandle;
}

/**
 * Thrown if an active `AudioManager` does not exist when a method that requires it is called.
 */
export class NullManagerError extends Error {
    public constructor(message: string = "AudioManager is uninitialized.") {
        super(message);
        this.name = "NullManagerError";
    }
}

/**
 * Thrown if an active stream does not exist when a method that requires it is called.
 */
export class StreamInactiveError extends Error {
    public constructor(message: string = "Target stream is inactive.") {
        super(message);
        this.name = "StreamInactiveError";
    }
}

/**
 * Manager class for Audiofox IPC operations.
 */
export default class AudiofoxManager {
    private static instance: AudiofoxManager;
    private readonly audiofox: Audiofox;
    private manager: AudioManager | null = null;
    private selectedSources: AudioSources = [];
    private state: StreamState | null = null;
    private active: boolean = false;
    private sources: AudioSources = [];

    private constructor(audiofox: Audiofox) {
        this.audiofox = audiofox;
        this.initScreenshareHandler();
    }

    /**
     * Create or receive the `AudiofoxManager` instance.
     */
    public static getInstance(audiofox: Audiofox): AudiofoxManager {
        if (!AudiofoxManager.instance) {
            AudiofoxManager.instance = new AudiofoxManager(audiofox);
        }
        return AudiofoxManager.instance;
    }

    /* These methods are currently flat for flexibility. If the AudiofoxManager is only used
     * in one place, start() could return an object like the standard AudioManager, removing
     * the need to check whether it has been called. */

    /**
     * Audiofox IPC manager equivalent of {@link Audiofox.start|`start()`}.
     * @throws {NullManagerError} - If an active `AudioManager` does not exist.
     */
    public async start(): Promise<void> {
        this.manager = await this.audiofox.start();
    }

    /* The 'name' field of AudioSources is currently the most consequential, due the transient
     * nature of the 'id' field. Therefore, only return this field. */

    /**
     * Audiofox IPC manager equivalent of {@link AudioManager.list|`list()`}.
     * @throws {NullManagerError} - If an active `AudioManager` does not exist.
     */
    public async list(): Promise<SourceName[]> {
        if (!this.manager) throw new NullManagerError("AudioManager not found.");
        this.sources = (await this.manager.list())
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter((source) => source.name !== "Element");
        return this.sources.map((source) => source.name);
    }

    /**
     * Audiofox IPC manager equivalent of {@link AudioManager.link|`link()`}.
     * @throws {NullManagerError} - If an active `AudioManager` does not exist.
     */
    public async link(sources: SourceName[]): Promise<void> {
        if (!this.manager) throw new NullManagerError("AudioManager not found.");
        this.selectedSources = this.sources.filter((source) => sources.includes(source.name));
    }

    /**
     * Audiofox IPC manager equivalent of {@link LinkHandle.unlink|`unlink()`}.
     * @throws {NullManagerError} - If an active `AudioManager` does not exist.
     * @throws {StreamInactiveError} - If an active stream does not exist.
     */
    public unlink(): void {
        if (!this.manager) throw new NullManagerError("AudioManager not found.");
        if (!this.active) throw new StreamInactiveError("No active stream to unlink from.");
        if (this.state) {
            this.state.handle.unlink();
            this.state.output.disconnect();
            this.state.processor.disconnect();
            // Audio transmission has already concluded, so no need to wait for this
            void this.state.audioContext.close();
            this.state = null;
        }
    }

    /**
     * Audiofox IPC manager equivalent of {@link AudioManager.stop|`stop()`}.
     * @throws {NullManagerError} - If an active `AudioManager` does not exist.
     */
    public stop(): void {
        if (!this.manager) throw new NullManagerError("AudioManager not found.");
        if (this.active) this.unlink();
        this.manager.stop();
        this.manager = null;
        this.selectedSources = [];
    }

    /**
     * Add an Audiofox hook to `getDisplayMedia` for seamless integration, and to ensure that
     * `link()` cannot be called independent of a screenshare context.
     */
    private initScreenshareHandler(): void {
        // Bind the original getDisplayMedia so we may interpose and attach our audio stream
        const getDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async (options?) => {
            // Get the video stream from setDisplayMediaRequestHandler
            const stream = await getDisplayMedia(options);

            // Load the audio resources
            try {
                const resources = await this.initResources();
                await this.initStream(resources, stream);
            } catch {
                // The error thrown if the worklet fails to load is already logged
            }

            // Return the stream to the caller
            return stream;
        };
    }

    /**
     * Receive a new set of `AudioResources` for use in a `MediaStream`.
     * @throws {DOMException} - If the audio worklet fails to load, will be of type
     * `AbortError` or `SyntaxError`.
     */
    private async initResources(): Promise<AudioResources> {
        // Initialize the audio context
        const audioContext = new AudioContext({
            latencyHint: "playback",
            sampleRate: 48000,
        });

        // Initialize the audio processor
        await audioWorkletFactory(audioContext, "audiofox");
        const processor = new AudioWorkletNode(audioContext, "audiofox", {
            outputChannelCount: [2],
        });

        // Initialize the processor output
        const output = audioContext.createMediaStreamDestination();
        processor.connect(output);

        return { audioContext, processor, output };
    }

    /**
     * Initialize the audio track of a given `MediaStream`.
     */
    private async initStream(resources: AudioResources, stream: MediaStream): Promise<void> {
        // Link to the selected sources
        console.log(`Starting screenshare with ${this.selectedSources.length} audio sources...`);
        if (this.selectedSources.length !== 0) {
            try {
                // Populate the StreamState
                this.state = {
                    // Forward the audio to the processor
                    handle: await this.manager!.link(this.selectedSources, (chunk) => {
                        resources.processor.port.postMessage(chunk, [chunk.buffer]); // zero-copy
                    }),
                    ...resources,
                };

                // Attach the audio track to the stream
                const audioTrack = resources.output.stream.getAudioTracks()[0];
                stream.addTrack(audioTrack);
            }
            // Catch errors on link
            catch (e) {
                console.warn(e);
            }
        }
        // Set the stream to active
        this.active = true;
    }
}
