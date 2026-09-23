/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button, H2, H3, Text } from "@vector-im/compound-web";

import styles from "./ElementCallMockView.module.css";
import { useViewModel, type ViewModel } from "../../core/viewmodel";
import { Flex } from "../../core/utils/Flex";
import { _t } from "../../core/i18n/i18n";

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
    /** The view model driving the mock. */
    vm: ElementCallMockViewModel;
}

/**
 * What the Element Call mock shows in place of a call: who is in the room's MatrixRTC session, a
 * button for every host bridge callback, a log of what was said in both directions, and the
 * configuration the host asked for.
 *
 * Everything it renders comes from {@link ElementCallMockViewModel}; the simulated Element Call
 * behind it — memberships, joining, muting, talking to the host — is that view model's business.
 *
 * The root is a region named after the title, in both states, so that tests can find the mock
 * wherever the application puts it.
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

    const title = _t("voip|element_call_mock|title");

    if (unknownRoom) {
        return (
            <section className={styles.mock} aria-label={title}>
                <Text as="span" size="sm" className={styles.error}>
                    {_t("voip|element_call_mock|unknown_room", { roomId })}
                </Text>
            </section>
        );
    }

    return (
        <section className={styles.mock} data-theme={theme} aria-label={title}>
            <H2>{title}</H2>
            <Text as="span" size="sm" className={styles.secondary}>
                {_t("voip|element_call_mock|status", {
                    roomId,
                    intent,
                    state: joined ? _t("voip|element_call_mock|in_call") : _t("voip|element_call_mock|in_lobby"),
                    theme: themeLabel,
                    language: languageLabel,
                })}
            </Text>

            <section>
                <H3 className={styles.sectionTitle}>{_t("voip|element_call_mock|participants")}</H3>
                {participants.length === 0 ? (
                    <Text as="span" size="sm" className={styles.secondary}>
                        {_t("voip|element_call_mock|no_participants")}
                    </Text>
                ) : (
                    <ul className={styles.members}>
                        {participants.map((participant) => (
                            <Text as="li" key={participant.id}>{participant.label}</Text>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <H3 className={styles.sectionTitle}>HostBridge</H3>
                <Flex className={styles.buttons} wrap="wrap" gap="var(--cpd-space-2x)">
                    <Button size="md" kind="primary" onClick={() => void vm.toggleJoined()}>
                        {joined ? "notifyHungUp" : "notifyJoined"}
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void vm.toggleAlwaysOnScreen()}>
                        setAlwaysOnScreen({String(!alwaysOnScreen)})
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void vm.toggleAudio()}>
                        {audioEnabled
                            ? _t("voip|element_call_mock|mute_audio")
                            : _t("voip|element_call_mock|unmute_audio")}
                    </Button>
                    <Button size="md" kind="secondary" onClick={() => void vm.toggleVideo()}>
                        {videoEnabled
                            ? _t("voip|element_call_mock|mute_video")
                            : _t("voip|element_call_mock|unmute_video")}
                    </Button>
                    {canClose && (
                        <Button size="md" kind="tertiary" onClick={() => void vm.close()}>
                            {_t("action|close")}
                        </Button>
                    )}
                </Flex>
                <Text as="span" size="sm" className={styles.secondary}>
                    {_t("voip|element_call_mock|host_bridge_facts", {
                        supportsReactions: String(supportsReactions),
                        allowJoinUnmutedViaIntent: String(allowJoinUnmutedViaIntent),
                        close: canClose ? _t("action|yes") : _t("action|no"),
                    })}
                </Text>
                <ol
                    className={styles.log}
                    aria-label={_t("voip|element_call_mock|log_label")}
                    // Scrollable, so it has to be reachable from the keyboard (axe: scrollable-region-focusable)
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    tabIndex={0}
                >
                    {log.map((entry) => (
                        <li key={entry.id}>{entry.text}</li>
                    ))}
                </ol>
            </section>

            <section>
                <H3 className={styles.sectionTitle}>{_t("voip|element_call_mock|configuration")}</H3>
                <pre
                    className={styles.config}
                    aria-label={_t("voip|element_call_mock|config_label")}
                    // Scrollable, so it has to be reachable from the keyboard (axe: scrollable-region-focusable)
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    tabIndex={0}
                >
                    {configJson}
                </pre>
                <Text as="span" size="sm" className={styles.secondary}>
                    {_t("voip|element_call_mock|initialized_with", { value: initializedWith })}
                </Text>
            </section>
        </section>
    );
};
