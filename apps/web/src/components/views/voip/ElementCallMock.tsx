/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Mock of Element Call's public React component (`@element-hq/element-call-component`).
 *
 * Same `ElementCall` / `initializeElementCall` exports as the package, typed with the package's own
 * types (via `ElementCallComponentTypes.ts`), so `ElementCallInstance` can load either module
 * interchangeably. Everything that would be a call UI is replaced by a member list, a dump of the
 * configuration, buttons that exercise every host bridge callback and a log of what was said in both
 * directions: what the mock told the host, and what the host asked through the component's handle.
 *
 * Used instead of the real component when `Developer.elementCallMockComponent` is on: in Playwright
 * (Element Web's test backend has no LiveKit) and for offline development. Never loaded otherwise.
 *
 * Not to be confused with the `ElementCall` widget model in `models/Call.ts`.
 */

import React, { type JSX, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Button } from "@vector-im/compound-web";
import { EventType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type CallMembership, MatrixRTCSessionEvent, type SessionMembershipData } from "matrix-js-sdk/src/matrixrtc";

import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { CallStore } from "../../../stores/CallStore";
import {
    type ConfigOptions,
    configurationForIntent,
    type DeviceMuteState,
    type ElementCallHandle,
    type ElementCallHostBridge,
    type ElementCallProps,
    UserIntent,
} from "./ElementCallComponentTypes";

let initialisedWith: ConfigOptions | null = null;

/**
 * Prepares the things Element Call needs before it can be shown. Await this
 * once, before rendering {@link ElementCall}. The mock only records the config.
 */
export async function initializeElementCall(config: ConfigOptions = {}): Promise<void> {
    initialisedWith = config;
}

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

interface LogEntry {
    id: number;
    text: string;
}

const NO_HOST: ElementCallHostBridge = {};

export const ElementCall = ({
    client,
    roomId,
    intent = UserIntent.JoinExistingCall,
    config,
    hostBridge = NO_HOST,
    ref,
    theme,
    language,
}: ElementCallProps): JSX.Element => {
    const room = client.getRoom(roomId);
    const rtcSession = useMemo(() => (room === null ? null : client.matrixRTC.getRoomSession(room)), [client, room]);

    const params = useMemo(() => ({ ...configurationForIntent(intent), ...config }), [intent, config]);

    // Like the real component, always talk to whichever bridge the host most recently gave us, without
    // restarting anything when it is a new object.
    const host = useRef(hostBridge);
    host.current = hostBridge;

    const memberships = useTypedEventEmitterState(
        rtcSession ?? undefined,
        MatrixRTCSessionEvent.MembershipsChanged,
        useCallback(() => rtcSession?.memberships ?? [], [rtcSession]),
    );

    const [muteState, setMuteState] = useState<DeviceMuteState>({ audio_enabled: true, video_enabled: true });
    const muteStateRef = useRef(muteState);
    muteStateRef.current = muteState;
    const [alwaysOnScreen, setAlwaysOnScreen] = useState(false);
    const [joined, setJoined] = useState(false);
    const [log, setLog] = useState<LogEntry[]>([]);
    const append = useCallback((text: string): void => {
        setLog((prev) => [...prev, { id: prev.length, text }]);
    }, []);

    // Element Call tells its host it has loaded as soon as it is on screen.
    useEffect(() => {
        void (host.current.contentLoaded?.() ?? Promise.resolve()).then(() => append("→ contentLoaded"));
    }, [append]);

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
        await host.current.notifyJoined?.();
        append("→ notifyJoined");
    }, [client, roomId, membershipStateKey, append]);
    const leave = useCallback(async (): Promise<void> => {
        await client.sendStateEvent(roomId, EventType.GroupCallMemberPrefix, {}, membershipStateKey);
        setJoined(false);
        await host.current.notifyHungUp?.();
        append("→ notifyHungUp");
    }, [client, roomId, membershipStateKey, append]);

    // Never leave a membership behind when torn down while "in call": the real component (or another
    // participant) would otherwise treat this device as still in the call, on the mock's focus.
    const joinedRef = useRef(false);
    joinedRef.current = joined;
    useEffect(() => {
        return () => {
            if (joinedRef.current) {
                void client.sendStateEvent(roomId, EventType.GroupCallMemberPrefix, {}, membershipStateKey);
            }
        };
    }, [client, roomId, membershipStateKey]);

    // What the host may ask of us, through the component's ref: log it, and behave roughly as the real
    // thing would. Each resolves once done, like the real handle.
    useImperativeHandle(
        ref,
        (): ElementCallHandle => ({
            join: async (devices) => {
                append(`← join ${JSON.stringify(devices)}`);
                await join();
            },
            hangUp: async () => {
                append("← hangUp");
                if (!joinedRef.current) throw new Error("Nothing in Element Call can hang up right now");
                await leave();
            },
            setDeviceMute: async (request) => {
                append(`← setDeviceMute ${JSON.stringify(request)}`);
                const next = {
                    audio_enabled: request.audio_enabled ?? muteStateRef.current.audio_enabled,
                    video_enabled: request.video_enabled ?? muteStateRef.current.video_enabled,
                };
                muteStateRef.current = next;
                setMuteState(next);
                return next;
            },
        }),
        [append, join, leave],
    );

    if (rtcSession === null || room === null) {
        logger.error(`Element Call was asked to call in ${roomId}, which its host's client does not know about`);
        return <div className="mx_ElementCallMock mx_ElementCallMock_error">Unknown room {roomId}</div>;
    }

    const ownUserId = client.getUserId();
    const ownDeviceId = client.getDeviceId();
    const describe = (membership: CallMembership): string => {
        const isOwnDevice = membership.sender === ownUserId && membership.deviceId === ownDeviceId;
        return `${membership.sender} (${membership.deviceId})${isOwnDevice ? " – you" : ""}`;
    };

    const setAlwaysOnScreenAndLog = async (next: boolean): Promise<void> => {
        await host.current.setAlwaysOnScreen?.(next);
        setAlwaysOnScreen(next);
        append(`→ setAlwaysOnScreen(${next})`);
    };
    const onToggleAlwaysOnScreen = (): Promise<void> => setAlwaysOnScreenAndLog(!alwaysOnScreen);
    const onToggleMute = async (device: keyof DeviceMuteState): Promise<void> => {
        const next = { ...muteState, [device]: !muteState[device] };
        setMuteState(next);
        await host.current.notifyDeviceMute?.(next);
        append(`→ notifyDeviceMute ${JSON.stringify(next)}`);
    };
    // Like the real thing (and the fake widget the Playwright tests use): closing leaves the call and gives
    // up the screen before asking the host to dismiss us.
    const onClose = async (): Promise<void> => {
        if (joined) await leave();
        if (alwaysOnScreen) await setAlwaysOnScreenAndLog(false);
        await host.current.close?.();
        append("→ close");
    };

    return (
        <div className="mx_ElementCallMock" data-theme={theme ?? undefined}>
            <h2 className="mx_ElementCallMock_title">Element Call (mock)</h2>
            <span className="mx_ElementCallMock_roomId">
                {room.roomId} · intent {intent} · {joined ? "in call" : "in lobby"} · theme {theme ?? "default"} ·
                language {language ?? "default"}
            </span>

            <section className="mx_ElementCallMock_section">
                <h3>Participants</h3>
                {memberships.length === 0 ? (
                    <span className="mx_ElementCallMock_empty">No one is in this call</span>
                ) : (
                    <ul className="mx_ElementCallMock_members">
                        {memberships.map((membership) => (
                            <li key={membership.membershipID}>{describe(membership)}</li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mx_ElementCallMock_section">
                <h3>HostBridge</h3>
                <div className="mx_ElementCallMock_buttons">
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
                </div>
                <span className="mx_ElementCallMock_empty">
                    supportsReactions: {String(hostBridge.supportsReactions ?? true)} · allowJoinUnmutedViaIntent:{" "}
                    {String(hostBridge.allowJoinUnmutedViaIntent ?? false)} · close: {hostBridge.close ? "yes" : "no"}
                </span>
                <ol className="mx_ElementCallMock_log" aria-label="HostBridge log">
                    {log.map((entry) => (
                        <li key={entry.id}>{entry.text}</li>
                    ))}
                </ol>
            </section>

            <section className="mx_ElementCallMock_section">
                <h3>Configuration</h3>
                <pre className="mx_ElementCallMock_config" aria-label="Effective configuration">
                    {JSON.stringify({ intent, config: config ?? {}, effective: params }, null, 2)}
                </pre>
                <span className="mx_ElementCallMock_empty">
                    initializeElementCall: {initialisedWith ? JSON.stringify(initialisedWith) : "not called"}
                </span>
            </section>
        </div>
    );
};
