/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { DesktopCapturerSource, Streams } from "electron";

import type {
    PreparedScreenShareAudioBridge,
    PreparedScreenShareAudioCapture,
    ScreenShareAudioBridgeFactory,
    ScreenShareAudioProvider,
    ValidatedDisplaySelection,
} from "./types.js";

export type DisplayMediaSessionState = "Idle" | "Selecting" | "PreparingAudio" | "Active" | "Stopping";

export interface DisplayMediaRequest {
    senderId: number;
    requesterWidgetId: string | null;
    audioRequested: boolean;
    callback: (streams: Streams) => void;
    onRequesterDestroyed(listener: () => void): () => void;
}

export interface PickerReply {
    requestId: number;
    sourceId: string | null;
    requesterWidgetId?: string | null;
    sessionId?: string | null;
}

export interface ScreenShareAudioSessionRelease {
    requestId: number;
    requesterWidgetId: string;
    sessionId: string;
}

export type ScreenShareAudioSessionBinding = ScreenShareAudioSessionRelease;

export interface DisplayMediaSessionDependencies {
    enumerateSources(): Promise<DesktopCapturerSource[]>;
    openPicker(senderId: number, requestId: number, requesterWidgetId: string | null): boolean;
    isElementOwnedSource(source: DesktopCapturerSource): boolean;
    provider?: ScreenShareAudioProvider;
    bridgeFactory?: ScreenShareAudioBridgeFactory;
}

interface OwnedRequest extends DisplayMediaRequest {
    id: number;
    abort: AbortController;
    callbackCompleted: boolean;
    disposeRequesterListener?: () => void;
    capture?: PreparedScreenShareAudioCapture;
    bridge?: PreparedScreenShareAudioBridge;
    sessionId?: string;
    cleanup?: Promise<void>;
}

const rejectedVideo = { id: "", name: "" };

export class DisplayMediaSessionController {
    private nextRequestId = 0;
    private completedCallbacks = 0;
    private current?: OwnedRequest;
    public state: DisplayMediaSessionState = "Idle";

    public constructor(private readonly deps: DisplayMediaSessionDependencies) {}

    public getAudit(): {
        state: DisplayMediaSessionState;
        activeRequests: number;
        activeCaptures: number;
        activeBridges: number;
        completedCallbacks: number;
        lastRequestId: number;
    } {
        return {
            state: this.state,
            activeRequests: this.current ? 1 : 0,
            activeCaptures: this.current?.capture ? 1 : 0,
            activeBridges: this.current?.bridge ? 1 : 0,
            completedCallbacks: this.completedCallbacks,
            lastRequestId: this.nextRequestId,
        };
    }

    public begin(request: DisplayMediaRequest): void {
        const previous = this.current;
        if (previous) this.invalidate(previous, true);

        const owned: OwnedRequest = {
            ...request,
            id: ++this.nextRequestId,
            abort: new AbortController(),
            callbackCompleted: false,
        };
        this.current = owned;
        owned.disposeRequesterListener = request.onRequesterDestroyed(() => this.invalidateIfCurrent(owned, true));
        this.state = previous ? "Stopping" : "Selecting";
        void this.openAfterCleanup(owned, previous);
    }

    public reply(senderId: number, reply: PickerReply): void {
        const owned = this.current;
        if (!owned || owned.id !== reply.requestId || owned.senderId !== senderId || this.state !== "Selecting") return;
        if (reply.sourceId === null) {
            this.invalidate(owned, true);
            return;
        }
        if (
            owned.sessionId &&
            (reply.requesterWidgetId !== undefined || reply.sessionId !== undefined) &&
            (reply.requesterWidgetId !== owned.requesterWidgetId || reply.sessionId !== owned.sessionId)
        ) {
            owned.sessionId = undefined;
        }
        this.state = "PreparingAudio";
        void this.prepare(owned, reply.sourceId);
    }

    public stop(): Promise<void> {
        const owned = this.current;
        if (!owned) return Promise.resolve();
        this.invalidate(owned, true);
        return this.cleanup(owned);
    }

    public bind(senderId: number, binding: ScreenShareAudioSessionBinding): boolean {
        const owned = this.current;
        if (
            !owned ||
            this.state !== "Selecting" ||
            owned.senderId !== senderId ||
            owned.id !== binding.requestId ||
            owned.requesterWidgetId !== binding.requesterWidgetId ||
            owned.sessionId !== undefined
        ) {
            return false;
        }
        owned.sessionId = binding.sessionId;
        return true;
    }

    public release(senderId: number, release: ScreenShareAudioSessionRelease): Promise<void> {
        const owned = this.current;
        if (
            !owned ||
            owned.senderId !== senderId ||
            owned.id !== release.requestId ||
            owned.requesterWidgetId !== release.requesterWidgetId ||
            owned.sessionId !== release.sessionId
        ) {
            return Promise.resolve();
        }
        this.invalidate(owned, true);
        return this.cleanup(owned);
    }

    private async openAfterCleanup(owned: OwnedRequest, previous?: OwnedRequest): Promise<void> {
        if (previous) await this.cleanup(previous);
        if (!this.isCurrent(owned)) return;
        this.state = "Selecting";
        try {
            if (!this.deps.openPicker(owned.senderId, owned.id, owned.requesterWidgetId)) {
                this.invalidate(owned, true);
            }
        } catch {
            this.invalidate(owned, true);
        }
    }

    private async prepare(owned: OwnedRequest, sourceId: string): Promise<void> {
        let validatedSource: DesktopCapturerSource | undefined;
        try {
            const sources = await this.raceAbort(owned, this.deps.enumerateSources());
            if (!sources || !this.isCurrent(owned)) return;
            const source = sources.find(({ id }) => id === sourceId);
            const kind = source && this.sourceKind(source.id);
            if (!source || !kind) {
                this.invalidate(owned, true);
                return;
            }
            validatedSource = source;

            const provider = this.deps.provider;
            const bridgeFactory = this.deps.bridgeFactory;
            if (
                !owned.audioRequested ||
                !owned.sessionId ||
                this.deps.isElementOwnedSource(source) ||
                !provider ||
                !bridgeFactory
            ) {
                this.activateVideoOnly(owned, source);
                return;
            }

            let available = false;
            try {
                available = (await this.raceAbort(owned, provider.getAvailability())) === "available";
            } catch {
                available = false;
            }
            if (!this.isCurrent(owned)) return;
            if (!available) {
                this.activateVideoOnly(owned, source);
                return;
            }

            const selection: ValidatedDisplaySelection = { sourceId: source.id, kind };
            const capturePromise = provider.prepare(selection, owned.abort.signal);
            const capture = await this.raceAbort(owned, capturePromise, (late) => late.stop());
            if (!capture || !this.isCurrent(owned)) return;
            owned.capture = capture;

            const bridgePromise = bridgeFactory.prepare(capture, owned.abort.signal);
            const bridge = await this.raceAbort(owned, bridgePromise, (late) => late.stop());
            if (!bridge || !this.isCurrent(owned)) return;
            owned.bridge = bridge;
            this.complete(owned, { video: source, audio: bridge.frame, enableLocalEcho: false });
            this.state = "Active";
            void bridge.waitForTerminal().then(() => this.invalidateIfCurrent(owned, false));
        } catch {
            if (this.isCurrent(owned)) {
                try {
                    if (owned.bridge) await owned.bridge.stop();
                    else await owned.capture?.stop();
                } catch {
                    // Fall back after releasing as much partial audio ownership as possible.
                }
                owned.bridge = undefined;
                owned.capture = undefined;
                if (validatedSource) this.activateVideoOnly(owned, validatedSource);
                else this.invalidate(owned, true);
            }
        }
    }

    private activateVideoOnly(owned: OwnedRequest, source: DesktopCapturerSource): void {
        if (!this.isCurrent(owned)) return;
        this.complete(owned, { video: source });
        owned.abort.abort();
        this.current = undefined;
        owned.disposeRequesterListener?.();
        owned.disposeRequesterListener = undefined;
        this.state = "Idle";
        void this.cleanup(owned);
    }

    private invalidateIfCurrent(owned: OwnedRequest, rejectCallback: boolean): void {
        if (this.isCurrent(owned)) this.invalidate(owned, rejectCallback);
    }

    private invalidate(owned: OwnedRequest, rejectCallback: boolean): void {
        owned.abort.abort();
        if (this.current === owned) this.current = undefined;
        this.state = "Stopping";
        if (rejectCallback) this.complete(owned, { video: rejectedVideo });
        void this.cleanup(owned);
    }

    private cleanup(owned: OwnedRequest): Promise<void> {
        owned.cleanup ??= (async () => {
            owned.disposeRequesterListener?.();
            try {
                if (owned.bridge) await owned.bridge.stop();
                else await owned.capture?.stop();
            } catch {
                // Ownership is still released and the controller remains reusable.
            } finally {
                owned.bridge = undefined;
                owned.capture = undefined;
                if (!this.current) this.state = "Idle";
            }
        })();
        return owned.cleanup;
    }

    private async raceAbort<T>(
        owned: OwnedRequest,
        promise: Promise<T>,
        disposeLate?: (value: T) => Promise<void>,
    ): Promise<T | undefined> {
        if (owned.abort.signal.aborted) return undefined;
        const aborted = Promise.withResolvers<undefined>();
        const onAbort = (): void => aborted.resolve(undefined);
        owned.abort.signal.addEventListener("abort", onAbort, { once: true });
        if (disposeLate) {
            void promise
                .then(async (value) => {
                    if (owned.abort.signal.aborted) await disposeLate(value);
                })
                .catch(() => {});
        }
        try {
            return await Promise.race([promise, aborted.promise]);
        } finally {
            owned.abort.signal.removeEventListener("abort", onAbort);
        }
    }

    private complete(owned: OwnedRequest, streams: Streams): void {
        if (owned.callbackCompleted) return;
        owned.callbackCompleted = true;
        this.completedCallbacks++;
        owned.callback(streams);
    }

    private isCurrent(owned: OwnedRequest): boolean {
        return this.current === owned && !owned.abort.signal.aborted;
    }

    private sourceKind(id: string): ValidatedDisplaySelection["kind"] | undefined {
        if (id.startsWith("window:")) return "window";
        if (id.startsWith("screen:")) return "screen";
        return undefined;
    }
}
