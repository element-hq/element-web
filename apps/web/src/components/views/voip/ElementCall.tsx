/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Mock of Element Call's public React component.
 *
 * Mirrors `component/index.tsx` of element-hq/element-call (PR #4233,
 * https://github.com/element-hq/element-call/blob/ace78de749ebb067cd258cd6be61610b14ca969a/component/index.tsx):
 * the same exports, the same prop and `HostBridge` shapes, so that swapping this
 * file for the real package is an import change. Everything that would be a call
 * UI is replaced by a member list, a dump of the configuration, buttons that
 * exercise every `HostBridge` method and a log of what the host asked for.
 *
 * Not to be confused with the `ElementCall` widget model in `models/Call.ts`.
 */

import React, { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@vector-im/compound-web";
import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type CallMembership, MatrixRTCSessionEvent, type SessionMembershipData } from "matrix-js-sdk/src/matrixrtc";

import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";

// ---------------------------------------------------------------------------
// Types mirrored from Element Call. Once the real package is a dependency these
// become re-exports of it.
// ---------------------------------------------------------------------------

/** `UserIntent` from EC's `src/UrlParams.ts`. Values match EW's `ElementCallIntent`. */
export enum UserIntent {
    StartNewCall = "start_call",
    JoinExistingCall = "join_existing",
    StartNewCallVoice = "start_call_voice",
    JoinExistingCallVoice = "join_existing_voice",
    StartNewCallDM = "start_call_dm",
    StartNewCallDMVoice = "start_call_dm_voice",
    JoinExistingCallDM = "join_existing_dm",
    JoinExistingCallDMVoice = "join_existing_dm_voice",
    Unknown = "unknown",
}

export enum HeaderStyle {
    None = "none",
    Standard = "standard",
    AppBar = "app_bar",
}

export enum BackgroundStyle {
    Solid = "solid",
    /** @public mirrored from Element Call; EW always uses Solid */
    Gradient = "gradient",
}

/** `UrlConfiguration` from EC's `src/UrlParams.ts`: how a call behaves. */
export interface UrlConfiguration {
    confineToRoom: boolean;
    preload: boolean;
    header: HeaderStyle;
    showControls: boolean;
    hideScreensharing: boolean;
    allowIceFallback: boolean;
    perParticipantE2EE: boolean;
    controlledAudioDevices: boolean;
    skipLobby: boolean;
    returnToLobby: boolean;
    sendNotificationType?: "ring" | "notification";
    autoLeaveWhenOthersLeft: boolean;
    waitForCallPickup: boolean;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    callIntent?: "audio" | "video";
}

/**
 * The subset of EC's `UrlProperties` a host may still want to state. The rest
 * (widget id, user/device id, analytics ids, …) is fixed by `hostedProperties`
 * in EC and is not the host's business.
 */
export interface HostedUrlProperties {
    lang: string | null;
    fonts: string[];
    fontScale: number | null;
    theme: string | null;
    background: BackgroundStyle;
}

/**
 * How Element Call should behave. Everything is optional; anything left out
 * takes the default that {@link ElementCallProps.intent} implies.
 */
export type ElementCallConfiguration = Partial<UrlConfiguration & HostedUrlProperties>;

/** Deployment-wide configuration passed to {@link initializeElementCall}. Opaque here. */
export type ConfigOptions = Record<string, unknown>;

export type DeviceMuteState = { audio_enabled: boolean; video_enabled: boolean };
export type DeviceMuteRequest = { audio_enabled?: boolean; video_enabled?: boolean };
export interface JoinCallData {
    audioInput: string | null;
    videoInput: string | null;
}

/** Something the host has asked of Element Call, which it is expected to acknowledge. */
export interface HostRequest<Data, Reply = void> {
    data: Data;
    /** Acknowledges the request. Should be called exactly once. */
    reply(reply: Reply): void;
}

/**
 * The part of an rxjs `Observable` the bridge relies on. EC's real interface
 * uses `Observable` from rxjs; an rxjs `Observable`/`Subject` satisfies this
 * structurally, so hosts can use rxjs without this mock depending on it.
 */
export interface Subscribable<T> {
    subscribe(next: (value: T) => void): { unsubscribe(): void };
}

/** `HostBridge` from EC's `src/HostBridge.ts`: Element Call's view of the application hosting it. */
export interface HostBridge {
    // What Element Call tells the host.
    setAlwaysOnScreen(alwaysOnScreen: boolean): Promise<void>;
    contentLoaded(): Promise<void>;
    notifyJoined(): Promise<void>;
    notifyHungUp(): Promise<void>;
    notifyDeviceMute(state: DeviceMuteState): Promise<void>;
    /** Absent when the host has no way to dismiss Element Call. */
    close?(): Promise<void>;

    // What the host asks of Element Call.
    themeChange$: Subscribable<HostRequest<{ name?: string }>>;
    join$: Subscribable<HostRequest<JoinCallData>>;
    hangUp$: Subscribable<HostRequest<Record<string, never>>>;
    deviceMute$: Subscribable<HostRequest<DeviceMuteRequest, DeviceMuteState>>;

    // What the host is capable of.
    readonly supportsReactions: boolean;
    /** Absent when Element Call should fetch media itself using its own client. */
    downloadMedia?(mxcUri: string): Promise<Blob>;
}

const never: Subscribable<never> = { subscribe: () => ({ unsubscribe: () => {} }) };

/** A bridge to nowhere, for when Element Call has no host. */
export const nullHostBridge: HostBridge = {
    setAlwaysOnScreen: async () => {},
    contentLoaded: async () => {},
    notifyJoined: async () => {},
    notifyHungUp: async () => {},
    notifyDeviceMute: async () => {},
    themeChange$: never,
    join$: never,
    hangUp$: never,
    deviceMute$: never,
    supportsReactions: true,
};

export interface ElementCallProps {
    /** The client to place the call with. Element Call does not manage a session of its own. */
    client: MatrixClient;
    /** The room to call in. The host's client must already know about it. */
    roomId: string;
    /** What the user asked for. Defaults to joining an existing group call. */
    intent?: UserIntent;
    /** Overrides for whatever {@link intent} implies. */
    config?: ElementCallConfiguration;
    /** How to reach the host while the call is running. Without one, Element Call assumes it has no host. */
    hostBridge?: HostBridge;
}

// ---------------------------------------------------------------------------
// Behaviour mirrored from Element Call.
// ---------------------------------------------------------------------------

/**
 * `configurationForIntent` from EC's `src/UrlParams.ts` (browser platform).
 * Kept equivalent so the mock shows the same effective configuration EC would
 * derive from EW's intent.
 */
export function configurationForIntent(intent: UserIntent): UrlConfiguration {
    let preset: UrlConfiguration = {
        confineToRoom: true,
        preload: false,
        header: HeaderStyle.AppBar,
        showControls: true,
        hideScreensharing: false,
        allowIceFallback: true,
        perParticipantE2EE: true,
        controlledAudioDevices: true,
        skipLobby: true,
        returnToLobby: false,
        sendNotificationType: "notification",
        autoLeaveWhenOthersLeft: false,
        waitForCallPickup: false,
    };
    switch (intent) {
        case UserIntent.StartNewCall:
        case UserIntent.JoinExistingCall:
            preset.skipLobby = false;
            preset.callIntent = "video";
            break;
        case UserIntent.StartNewCallVoice:
        case UserIntent.JoinExistingCallVoice:
            preset.skipLobby = false;
            preset.callIntent = "audio";
            break;
        case UserIntent.StartNewCallDM:
        case UserIntent.StartNewCallDMVoice:
            preset.skipLobby = true;
            preset.sendNotificationType = "ring";
            preset.autoLeaveWhenOthersLeft = true;
            preset.waitForCallPickup = true;
            preset.callIntent = intent === UserIntent.StartNewCallDMVoice ? "audio" : "video";
            break;
        case UserIntent.JoinExistingCallDM:
        case UserIntent.JoinExistingCallDMVoice:
            preset.skipLobby = true;
            preset.autoLeaveWhenOthersLeft = true;
            preset.callIntent = intent === UserIntent.JoinExistingCallDMVoice ? "audio" : "video";
            break;
        default:
            preset = {
                confineToRoom: false,
                preload: false,
                header: HeaderStyle.Standard,
                showControls: true,
                hideScreensharing: false,
                allowIceFallback: false,
                perParticipantE2EE: false,
                controlledAudioDevices: false,
                skipLobby: false,
                returnToLobby: false,
                autoLeaveWhenOthersLeft: false,
                waitForCallPickup: false,
            };
    }
    return preset;
}

let initialisedWith: ConfigOptions | null = null;

/**
 * The MatrixRTC membership the mock publishes when it "joins", so that Element Web sees a running call
 * (room list indicator, join button, and — crucially — the `ElementCall` model does not destroy the
 * call as memberless when the user navigates away). Same content as
 * `playwright/sample-files/fake-element-call.html`; the real component's `MatrixRTCSession` does this
 * for real.
 */
const mockMembership = (deviceId: string): SessionMembershipData => ({
    "application": "m.call",
    "call_id": "",
    "device_id": deviceId,
    "expires": 14400000,
    "foci_preferred": [{ livekit_alias: "any-alias", livekit_service_url: "https://example.org", type: "livekit" }],
    "focus_active": { focus_selection: "oldest_membership", type: "livekit" },
    "m.call.intent": "video",
    "scope": "m.room",
});

/**
 * Prepares the things Element Call needs before it can be shown. Await this
 * once, before rendering {@link ElementCall}. The mock only records the config.
 */
export async function initializeElementCall(config: ConfigOptions = {}): Promise<void> {
    initialisedWith = config;
}

// ---------------------------------------------------------------------------
// The mock component.
// ---------------------------------------------------------------------------

interface LogEntry {
    id: number;
    text: string;
}

export const ElementCall = ({
    client,
    roomId,
    intent = UserIntent.JoinExistingCall,
    config,
    hostBridge = nullHostBridge,
}: ElementCallProps): JSX.Element => {
    const room = client.getRoom(roomId);
    const rtcSession = useMemo(() => (room === null ? null : client.matrixRTC.getRoomSession(room)), [client, room]);

    const params = useMemo(() => ({ ...configurationForIntent(intent), ...config }), [intent, config]);

    const memberships = useTypedEventEmitterState(
        rtcSession ?? undefined,
        MatrixRTCSessionEvent.MembershipsChanged,
        useCallback(() => rtcSession?.memberships ?? [], [rtcSession]),
    );

    const [muteState, setMuteState] = useState<DeviceMuteState>({ audio_enabled: true, video_enabled: true });
    const [alwaysOnScreen, setAlwaysOnScreen] = useState(false);
    const [joined, setJoined] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);
    const append = useCallback((text: string): void => {
        setLog((prev) => [...prev, { id: prev.length, text }]);
    }, []);

    // Element Call tells its host it has loaded as soon as it is on screen.
    useEffect(() => {
        void hostBridge.contentLoaded().then(() => append("→ contentLoaded"));
    }, [hostBridge, append]);

    // "Joining" publishes an RTC membership for this device and tells the host; "leaving" clears both.
    const membershipStateKey = `_${client.getUserId()}_${client.getDeviceId()}_m.call`;
    const join = useCallback(async (): Promise<void> => {
        await client.sendStateEvent(
            roomId,
            EventType.GroupCallMemberPrefix,
            mockMembership(client.getDeviceId() ?? ""),
            membershipStateKey,
        );
        setJoined(true);
        await hostBridge.notifyJoined();
        append("→ notifyJoined");
    }, [client, roomId, membershipStateKey, hostBridge, append]);
    const leave = useCallback(async (): Promise<void> => {
        await client.sendStateEvent(roomId, EventType.GroupCallMemberPrefix, {}, membershipStateKey);
        setJoined(false);
        await hostBridge.notifyHungUp();
        append("→ notifyHungUp");
    }, [client, roomId, membershipStateKey, hostBridge, append]);

    // Subscribe to everything the host may ask for, acknowledge it, and behave
    // roughly as the real thing would.
    useEffect(() => {
        const subs = [
            hostBridge.themeChange$.subscribe((req) => {
                append(`← themeChange ${JSON.stringify(req.data)}`);
                req.reply();
            }),
            hostBridge.join$.subscribe((req) => {
                append(`← join ${JSON.stringify(req.data)}`);
                req.reply();
                void join();
            }),
            hostBridge.hangUp$.subscribe((req) => {
                append("← hangUp");
                void leave().then(() => req.reply());
            }),
            hostBridge.deviceMute$.subscribe((req) => {
                append(`← deviceMute ${JSON.stringify(req.data)}`);
                setMuteState((prev) => {
                    const next = {
                        audio_enabled: req.data.audio_enabled ?? prev.audio_enabled,
                        video_enabled: req.data.video_enabled ?? prev.video_enabled,
                    };
                    req.reply(next);
                    return next;
                });
            }),
        ];
        return () => subs.forEach((s) => s.unsubscribe());
    }, [hostBridge, append, join, leave]);

    if (rtcSession === null || room === null) {
        logger.error(`Element Call was asked to call in ${roomId}, which its host's client does not know about`);
        return <div className="mx_ElementCall mx_ElementCall_error">Unknown room {roomId}</div>;
    }

    const ownUserId = client.getUserId();
    const ownDeviceId = client.getDeviceId();
    const describe = (membership: CallMembership): string => {
        const isOwnDevice = membership.sender === ownUserId && membership.deviceId === ownDeviceId;
        return `${membership.sender} (${membership.deviceId})${isOwnDevice ? " – you" : ""}`;
    };

    const setAlwaysOnScreenAndLog = async (next: boolean): Promise<void> => {
        await hostBridge.setAlwaysOnScreen(next);
        setAlwaysOnScreen(next);
        append(`→ setAlwaysOnScreen(${next})`);
    };
    const onToggleAlwaysOnScreen = (): Promise<void> => setAlwaysOnScreenAndLog(!alwaysOnScreen);
    const onToggleMute = async (device: keyof DeviceMuteState): Promise<void> => {
        const next = { ...muteState, [device]: !muteState[device] };
        setMuteState(next);
        await hostBridge.notifyDeviceMute(next);
        append(`→ notifyDeviceMute ${JSON.stringify(next)}`);
    };
    // Like the real thing (and the fake widget the Playwright tests use): closing leaves the call and gives
    // up the screen before asking the host to dismiss us.
    const onClose = async (): Promise<void> => {
        if (joined) await leave();
        if (alwaysOnScreen) await setAlwaysOnScreenAndLog(false);
        await hostBridge.close?.();
        append("→ close");
    };
    const onDownloadMedia = async (): Promise<void> => {
        const blob = await hostBridge.downloadMedia?.("mxc://example.org/mock");
        append(`→ downloadMedia → ${blob?.size ?? "?"} bytes`);
    };

    return (
        <div className="mx_ElementCall">
            <h2 className="mx_ElementCall_title">Element Call (mock)</h2>
            <span className="mx_ElementCall_roomId">
                {room.roomId} · intent {intent} · {joined ? "in call" : "in lobby"}
            </span>

            <section className="mx_ElementCall_section">
                <h3>Participants</h3>
                {memberships.length === 0 ? (
                    <span className="mx_ElementCall_empty">No one is in this call</span>
                ) : (
                    <ul className="mx_ElementCall_members">
                        {memberships.map((membership) => (
                            <li key={membership.membershipID}>{describe(membership)}</li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mx_ElementCall_section">
                <h3>HostBridge</h3>
                <div className="mx_ElementCall_buttons">
                    <Button size="md" kind="primary" onClick={() => void (joined ? leave() : join())}>
                        {joined ? "notifyHungUp" : "notifyJoined"}
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void onToggleAlwaysOnScreen()}>
                        setAlwaysOnScreen({String(!alwaysOnScreen)})
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void onToggleMute("audio_enabled")}>
                        {muteState.audio_enabled ? "mute audio" : "unmute audio"}
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void onToggleMute("video_enabled")}>
                        {muteState.video_enabled ? "mute video" : "unmute video"}
                    </Button>
                    {hostBridge.close && (
                        <Button size="md" kind="tertiary" onClick={() => void onClose()}>
                            close
                        </Button>
                    )}
                    {hostBridge.downloadMedia && (
                        <Button size="md" kind="tertiary" onClick={() => void onDownloadMedia()}>
                            downloadMedia
                        </Button>
                    )}
                </div>
                <span className="mx_ElementCall_empty">
                    supportsReactions: {String(hostBridge.supportsReactions)} · close: {hostBridge.close ? "yes" : "no"}{" "}
                    · downloadMedia: {hostBridge.downloadMedia ? "yes" : "no"}
                </span>
                <ol className="mx_ElementCall_log" aria-label="HostBridge log">
                    {log.map((entry) => (
                        <li key={entry.id}>{entry.text}</li>
                    ))}
                </ol>
            </section>

            <section className="mx_ElementCall_section">
                <h3>Configuration</h3>
                <pre className="mx_ElementCall_config" aria-label="Effective configuration">
                    {JSON.stringify({ intent, config: config ?? {}, effective: params }, null, 2)}
                </pre>
                <span className="mx_ElementCall_empty">
                    initializeElementCall: {initialisedWith ? JSON.stringify(initialisedWith) : "not called"}
                </span>
            </section>
        </div>
    );
};
