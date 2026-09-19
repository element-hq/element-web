/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel } from "@element-hq/web-shared-components";
import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixRTCSession, MatrixRTCSessionEvent, type SessionMembershipData } from "matrix-js-sdk/src/matrixrtc";

import {
    type ElementCallMockParticipant,
    type ElementCallMockViewSnapshot,
    type ElementCallMockViewModel as ElementCallMockViewModelInterface,
} from "../../components/views/voip/ElementCallMockView";
import { CallStore } from "../../stores/CallStore";
import {
    type ConfigOptions,
    configurationForIntent,
    type ElementCallHandle,
    type ElementCallHostBridge,
    type ElementCallProps,
    type UserIntent,
} from "@element-hq/element-call-component/api";

/**
 * How long the mock's membership stays valid. Short on purpose: a membership left behind (reload, flag
 * flipped, crash) is picked up by anyone else joining — including the real component on this very
 * device — as "the oldest member's focus", so it must age out quickly. Long enough for a Playwright test.
 */
const MOCK_MEMBERSHIP_EXPIRY_MS = 10 * 60 * 1000;

/**
 * The MatrixRTC membership the mock publishes when it "joins", so that Element Web sees a running call
 * (room list indicator, join button, and — crucially — the `ElementCall` model does not destroy the
 * call as memberless when the user navigates away). The real component's `MatrixRTCSession` does this
 * for real.
 *
 * The preferred focus is the deployment's real one when Element Web knows it (well-known / RTC
 * transports), so that a stale mock membership never sends a real Element Call to a bogus LiveKit
 * service; only without any configured transport does it fall back to a placeholder (as
 * `playwright/sample-files/fake-element-call.html` does).
 */
const mockMembership = (deviceId: string): SessionMembershipData => {
    const configured = CallStore.instance
        .getConfiguredRTCTransports()
        .filter((t) => t.type === "livekit" && "livekit_service_url" in t);
    const fociPreferred =
        configured.length > 0
            ? configured.map((t) => ({ ...t, livekit_alias: "element-call-mock" }))
            : [{ livekit_alias: "any-alias", livekit_service_url: "https://example.org", type: "livekit" }];
    return {
        "application": "m.call",
        "call_id": "",
        "device_id": deviceId,
        "expires": MOCK_MEMBERSHIP_EXPIRY_MS,
        "foci_preferred": fociPreferred,
        "focus_active": { focus_selection: "oldest_membership", type: "livekit" },
        "m.call.intent": "video",
        "scope": "m.room",
    };
};

/** The props Element Call takes live: a new one is a reason to re-render, never to restart. */
export interface LiveProps {
    intent: UserIntent;
    config: ElementCallProps["config"];
    hostBridge: ElementCallHostBridge;
    theme?: string;
    language?: string;
}

export interface Props extends LiveProps {
    /** The host's client, which the mock reads the session from and publishes its membership with. */
    client: MatrixClient;
    /** The room to call in. */
    roomId: string;
    /** What `initializeElementCall` was last given, or null if the host never called it. */
    initializedWith: ConfigOptions | null;
}

/** What the header shows of the theme and the language the host asked for. */
const presentationOf = ({
    theme,
    language,
}: LiveProps): Pick<ElementCallMockViewSnapshot, "theme" | "themeLabel" | "languageLabel"> => ({
    theme,
    themeLabel: theme ?? "default",
    languageLabel: language ?? "default",
});

/** What the host bridge says about itself, with the defaults Element Call reads into it. */
const factsOf = (
    hostBridge: ElementCallHostBridge,
): Pick<ElementCallMockViewSnapshot, "canClose" | "supportsReactions" | "allowJoinUnmutedViaIntent"> => ({
    canClose: hostBridge.close !== undefined,
    supportsReactions: hostBridge.supportsReactions ?? true,
    allowJoinUnmutedViaIntent: hostBridge.allowJoinUnmutedViaIntent ?? false,
});

/** Everyone in the room's MatrixRTC session, our own device marked as such. */
const participantsOf = (rtcSession: MatrixRTCSession | null, client: MatrixClient): ElementCallMockParticipant[] => {
    const ownUserId = client.getUserId();
    const ownDeviceId = client.getDeviceId();
    return (rtcSession?.memberships ?? []).map((membership) => {
        const isOwnDevice = membership.sender === ownUserId && membership.deviceId === ownDeviceId;
        return {
            id: membership.membershipID,
            label: `${membership.sender} (${membership.deviceId})${isOwnDevice ? " – you" : ""}`,
        };
    });
};

/** The intent, the host's overrides and the configuration they add up to, as the mock displays them. */
const configJsonOf = ({ intent, config }: LiveProps): string =>
    JSON.stringify(
        { intent, config: config ?? {}, effective: { ...configurationForIntent(intent), ...config } },
        null,
        2,
    );

/**
 * The simulated Element Call behind {@link ElementCallMockView}: the room's MatrixRTC session, the
 * membership the mock publishes while it is "in the call", its mute state, and both halves of the
 * conversation with the host — what the mock tells the host bridge, and what the host asks of it
 * through {@link handle}.
 *
 * Not to be confused with the `ElementCall` widget model in `models/Call.ts`.
 */
export class ElementCallMockViewModel
    extends BaseViewModel<ElementCallMockViewSnapshot, Props>
    implements ElementCallMockViewModelInterface
{
    private readonly rtcSession: MatrixRTCSession | null;
    /** The state key our own membership lives under. */
    private readonly membershipStateKey: string;
    private nextLogId = 0;
    private started = false;

    public constructor(props: Props) {
        const room = props.client.getRoom(props.roomId);
        const rtcSession = room === null ? null : props.client.matrixRTC.getRoomSession(room);
        super(props, {
            unknownRoom: rtcSession === null,
            roomId: props.roomId,
            intent: props.intent,
            joined: false,
            ...presentationOf(props),
            participants: participantsOf(rtcSession, props.client),
            audioEnabled: true,
            videoEnabled: true,
            alwaysOnScreen: false,
            ...factsOf(props.hostBridge),
            log: [],
            configJson: configJsonOf(props),
            initializedWith: props.initializedWith ? JSON.stringify(props.initializedWith) : "not called",
        });
        this.rtcSession = rtcSession;
        this.membershipStateKey = `_${props.client.getUserId()}_${props.client.getDeviceId()}_m.call`;

        if (rtcSession === null) {
            logger.error(
                `Element Call was asked to call in ${props.roomId}, which its host's client does not know about`,
            );
        } else {
            this.disposables.trackListener(rtcSession, MatrixRTCSessionEvent.MembershipsChanged, this.onMemberships);
        }
    }

    /**
     * Tells the host that Element Call has loaded, as the real component does once it is on screen.
     * Separate from the constructor because React may build a view model and throw it away without
     * ever mounting it, and a host told about that would be told a lie.
     */
    public start(): void {
        // In StrictMode dev, a consumer's useEffect can briefly fire with a stale `vm` reference
        // between the hook disposing the old view model and React re-rendering with the new one.
        if (this.started || this.isDisposed) return;
        this.started = true;
        void (this.props.hostBridge.contentLoaded?.() ?? Promise.resolve()).then(() => this.append("→ contentLoaded"));
    }

    /**
     * Never leaves a membership behind when torn down while in the call: the real component (or
     * another participant) would otherwise treat this device as still in the call, on the mock's focus.
     */
    public dispose(): void {
        const { joined } = this.snapshot.current;
        super.dispose();
        if (joined) void this.clearMembership();
    }

    /**
     * Updates the props Element Call takes live, so that the mock — like the real component — always
     * talks to whichever host bridge it was most recently given, and follows the theme and the
     * language, without restarting anything.
     */
    public setProps(props: LiveProps): void {
        this.props = { ...this.props, ...props };
        this.snapshot.merge({
            intent: props.intent,
            ...presentationOf(props),
            ...factsOf(props.hostBridge),
            configJson: configJsonOf(props),
        });
    }

    /**
     * What the host may ask of the mock, through the component's ref: each request is logged, and
     * answered roughly as the real thing would answer it, resolving once done.
     */
    public readonly handle: ElementCallHandle = {
        join: async (devices) => {
            this.append(`← join ${JSON.stringify(devices)}`);
            await this.joinCall();
        },
        hangUp: async () => {
            this.append("← hangUp");
            if (!this.snapshot.current.joined) throw new Error("Nothing in Element Call can hang up right now");
            await this.leaveCall();
        },
        setDeviceMute: async (request) => {
            this.append(`← setDeviceMute ${JSON.stringify(request)}`);
            const { audioEnabled, videoEnabled } = this.snapshot.current;
            const next = {
                audio_enabled: request.audio_enabled ?? audioEnabled,
                video_enabled: request.video_enabled ?? videoEnabled,
            };
            // The host asked for this, so there is nothing to tell it about afterwards.
            this.snapshot.merge({ audioEnabled: next.audio_enabled, videoEnabled: next.video_enabled });
            return next;
        },
    };

    public toggleJoined = async (): Promise<void> => {
        if (this.snapshot.current.joined) await this.leaveCall();
        else await this.joinCall();
    };

    public toggleAlwaysOnScreen = (): Promise<void> => this.setAlwaysOnScreen(!this.snapshot.current.alwaysOnScreen);

    public toggleAudio = (): Promise<void> => this.setMute({ audioEnabled: !this.snapshot.current.audioEnabled });

    public toggleVideo = (): Promise<void> => this.setMute({ videoEnabled: !this.snapshot.current.videoEnabled });

    /**
     * Like the real thing (and the fake widget the Playwright tests use): closing leaves the call and
     * gives up the screen before asking the host to dismiss us.
     */
    public close = async (): Promise<void> => {
        if (this.snapshot.current.joined) await this.leaveCall();
        if (this.snapshot.current.alwaysOnScreen) await this.setAlwaysOnScreen(false);
        await this.props.hostBridge.close?.();
        this.append("→ close");
    };

    /** "Joining" publishes an RTC membership for this device and tells the host. */
    private async joinCall(): Promise<void> {
        const { client, roomId } = this.props;
        await client.sendStateEvent(
            roomId,
            EventType.GroupCallMemberPrefix,
            mockMembership(client.getDeviceId() ?? ""),
            this.membershipStateKey,
        );
        this.snapshot.merge({ joined: true });
        await this.props.hostBridge.notifyJoined?.();
        this.append("→ notifyJoined");
    }

    /** "Leaving" clears that membership again, and tells the host. */
    private async leaveCall(): Promise<void> {
        await this.clearMembership();
        this.snapshot.merge({ joined: false });
        await this.props.hostBridge.notifyHungUp?.();
        this.append("→ notifyHungUp");
    }

    private clearMembership(): Promise<unknown> {
        const { client, roomId } = this.props;
        return client.sendStateEvent(roomId, EventType.GroupCallMemberPrefix, {}, this.membershipStateKey);
    }

    private async setAlwaysOnScreen(alwaysOnScreen: boolean): Promise<void> {
        await this.props.hostBridge.setAlwaysOnScreen?.(alwaysOnScreen);
        this.snapshot.merge({ alwaysOnScreen });
        this.append(`→ setAlwaysOnScreen(${alwaysOnScreen})`);
    }

    private async setMute(
        change: Partial<Pick<ElementCallMockViewSnapshot, "audioEnabled" | "videoEnabled">>,
    ): Promise<void> {
        const { audioEnabled, videoEnabled } = { ...this.snapshot.current, ...change };
        this.snapshot.merge({ audioEnabled, videoEnabled });
        const state = { audio_enabled: audioEnabled, video_enabled: videoEnabled };
        await this.props.hostBridge.notifyDeviceMute?.(state);
        this.append(`→ notifyDeviceMute ${JSON.stringify(state)}`);
    }

    private readonly onMemberships = (): void => {
        this.snapshot.merge({ participants: participantsOf(this.rtcSession, this.props.client) });
    };

    private append(text: string): void {
        this.snapshot.merge({ log: [...this.snapshot.current.log, { id: this.nextLogId++, text }] });
    }
}
