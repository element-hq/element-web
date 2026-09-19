/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, H2, H3, Text } from "@vector-im/compound-web";
import { useViewModel, type ViewModel } from "@element-hq/web-shared-components";

/** One line of the log: what the mock told the host, or what the host asked of the mock. */
export interface ElementCallMockLogEntry {
    id: number;
    text: string;
}

/** One member of the room's MatrixRTC session. */
export interface ElementCallMockParticipant {
    id: string;
    /** The member as the mock lists them, our own device marked as such. */
    label: string;
}

export interface ElementCallMockViewSnapshot {
    /**
     * Whether the host's client does not know the room the mock was asked to call in: nothing but
     * an error is rendered in that case.
     */
    unknownRoom: boolean;
    /** The room the mock is calling in. */
    roomId: string;
    /** What the host said the user asked for. */
    intent: string;
    /** Whether the mock is in the call: it has published an RTC membership and told the host. */
    joined: boolean;
    /** The theme the host asked for, or undefined to leave it to the mock. */
    theme?: string;
    /** The theme and the language as the header shows them, "default" when the host named neither. */
    themeLabel: string;
    languageLabel: string;
    /** Everyone in the room's MatrixRTC session. */
    participants: ElementCallMockParticipant[];
    /** The mute state the mock reports to the host. */
    audioEnabled: boolean;
    videoEnabled: boolean;
    /** Whether the mock has asked the host to keep it on screen. */
    alwaysOnScreen: boolean;
    /** Whether the host offers to close the call; without that there is nothing to close us. */
    canClose: boolean;
    /** What the host bridge says about itself, as Element Call reads it. */
    supportsReactions: boolean;
    allowJoinUnmutedViaIntent: boolean;
    /** What was said in both directions, oldest first. */
    log: ElementCallMockLogEntry[];
    /** The intent, the host's overrides and the configuration they add up to, pretty-printed. */
    configJson: string;
    /** What `initializeElementCall` was given, or that it was never called. */
    initializedWith: string;
}

export interface ElementCallMockViewActions {
    /** Joins the call when in the lobby, leaves it when in the call. */
    toggleJoined(): Promise<void>;
    /** Asks the host to keep the mock on screen, or to stop doing so. */
    toggleAlwaysOnScreen(): Promise<void>;
    /** Mutes or unmutes, and tells the host about the state that results. */
    toggleAudio(): Promise<void>;
    toggleVideo(): Promise<void>;
    /** Leaves the call, gives up the screen and asks the host to dismiss the mock. */
    close(): Promise<void>;
}

/**
 * The view model for the Element Call mock.
 */
export type ElementCallMockViewModel = ViewModel<ElementCallMockViewSnapshot, ElementCallMockViewActions>;

export interface ElementCallMockViewProps {
    vm: ElementCallMockViewModel;
}

/**
 * What the Element Call mock shows in place of a call: who is in the room's MatrixRTC session, a
 * button for every host bridge callback, a log of what was said in both directions, and the
 * configuration the host asked for.
 *
 * Everything it renders comes from {@link ElementCallMockViewModel}; the simulated Element Call
 * behind it — memberships, joining, muting, talking to the host — is that view model's business.
 */
export const ElementCallMockView = ({ vm }: ElementCallMockViewProps): JSX.Element => {
    const {
        unknownRoom,
        roomId,
        intent,
        joined,
        theme,
        themeLabel,
        languageLabel,
        participants,
        audioEnabled,
        videoEnabled,
        alwaysOnScreen,
        canClose,
        supportsReactions,
        allowJoinUnmutedViaIntent,
        log,
        configJson,
        initializedWith,
    } = useViewModel(vm);

    if (unknownRoom) {
        return (
            <div className="mx_ElementCallMock">
                <Text as="span" size="sm" className="mx_ElementCallMock_error">
                    Unknown room {roomId}
                </Text>
            </div>
        );
    }

    return (
        <div className="mx_ElementCallMock" data-theme={theme}>
            <H2 className="mx_ElementCallMock_title">Element Call (mock)</H2>
            <Text as="span" size="sm" className="mx_ElementCallMock_roomId">
                {roomId} · intent {intent} · {joined ? "in call" : "in lobby"} · theme {themeLabel} · language{" "}
                {languageLabel}
            </Text>

            <section className="mx_ElementCallMock_section">
                <H3>Participants</H3>
                {participants.length === 0 ? (
                    <Text as="span" size="sm" className="mx_ElementCallMock_empty">
                        No one is in this call
                    </Text>
                ) : (
                    <ul className="mx_ElementCallMock_members">
                        {participants.map((participant) => (
                            <li key={participant.id}>{participant.label}</li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mx_ElementCallMock_section">
                <H3>HostBridge</H3>
                <div className="mx_ElementCallMock_buttons">
                    <Button size="md" kind="primary" onClick={() => void vm.toggleJoined()}>
                        {joined ? "notifyHungUp" : "notifyJoined"}
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void vm.toggleAlwaysOnScreen()}>
                        setAlwaysOnScreen({String(!alwaysOnScreen)})
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void vm.toggleAudio()}>
                        {audioEnabled ? "mute audio" : "unmute audio"}
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void vm.toggleVideo()}>
                        {videoEnabled ? "mute video" : "unmute video"}
                    </Button>
                    {canClose && (
                        <Button size="md" kind="tertiary" onClick={() => void vm.close()}>
                            close
                        </Button>
                    )}
                </div>
                <Text as="span" size="sm" className="mx_ElementCallMock_empty">
                    supportsReactions: {String(supportsReactions)} · allowJoinUnmutedViaIntent:{" "}
                    {String(allowJoinUnmutedViaIntent)} · close: {canClose ? "yes" : "no"}
                </Text>
                <ol className="mx_ElementCallMock_log" aria-label="HostBridge log">
                    {log.map((entry) => (
                        <li key={entry.id}>{entry.text}</li>
                    ))}
                </ol>
            </section>

            <section className="mx_ElementCallMock_section">
                <H3>Configuration</H3>
                <pre className="mx_ElementCallMock_config" aria-label="Effective configuration">
                    {configJson}
                </pre>
                <Text as="span" size="sm" className="mx_ElementCallMock_empty">
                    initializeElementCall: {initializedWith}
                </Text>
            </section>
        </div>
    );
};
