/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, useContext, useId } from "react";
import { CallType, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { Form, InlineField, Label, ToggleInput } from "@vector-im/compound-web";
import {
    EndCallIcon,
    VideoCallSolidIcon,
    VoiceCallSolidIcon,
    VolumeOffSolidIcon,
    VolumeOnSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import RoomAvatar from "../avatars/RoomAvatar";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { useIncomingCallToast } from "../../../hooks/useIncomingCallToast";
import { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import { SDKContext } from "../../../contexts/SDKContext";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";

interface SilenceControl {
    silenced: boolean;
    disabled: boolean;
    onToggle: (e: ButtonEvent) => void;
}

interface LayoutProps {
    room?: Room;
    title: string;
    isVoice: boolean;
    onAccept: (e: ButtonEvent) => void;
    onDecline: (e: ButtonEvent) => void;
    /** Optional silence/mute toggle (legacy 1:1 calls). */
    silence?: SilenceControl;
    /** Optional extra content between subtitle and buttons (e.g. a video toggle). */
    children?: ReactNode;
}

/**
 * Presentational Slack-huddle-style incoming-call surface: full-screen dimmed
 * backdrop, large avatar, caller name, subtitle, and round decline/accept
 * buttons. Owns the overlay so that a view returning `null` (e.g. an unresolved
 * legacy call) renders nothing at all — never an empty, un-dismissable backdrop.
 */
function IncomingCallLayout({
    room,
    title,
    isVoice,
    onAccept,
    onDecline,
    silence,
    children,
}: LayoutProps): JSX.Element {
    const AcceptIcon = isVoice ? VoiceCallSolidIcon : VideoCallSolidIcon;
    const subtitle = isVoice ? _t("voip|voice_call_incoming") : _t("voip|video_call_incoming");
    return (
        <div className="mx_IncomingCallPopup" role="alertdialog" aria-modal="true">
            <div className="mx_IncomingCallPopup_card">
                <div className="mx_IncomingCallView">
                    <RoomAvatar room={room ?? undefined} size="96px" />
                    <h2 className="mx_IncomingCallView_title">{title}</h2>
                    <span className="mx_IncomingCallView_subtitle">{subtitle}</span>
                    {children}
                    <div className="mx_IncomingCallView_buttons">
                        {silence && (
                            <AccessibleButton
                                className="mx_IncomingCallView_button mx_IncomingCallView_button_silence"
                                onClick={silence.onToggle}
                                disabled={silence.disabled}
                                title={silence.silenced ? _t("voip|unsilence") : _t("voip|silence")}
                            >
                                {silence.silenced ? <VolumeOffSolidIcon /> : <VolumeOnSolidIcon />}
                            </AccessibleButton>
                        )}
                        <AccessibleButton
                            className="mx_IncomingCallView_button mx_IncomingCallView_button_decline"
                            onClick={onDecline}
                            title={_t("action|decline")}
                        >
                            <EndCallIcon />
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_IncomingCallView_button mx_IncomingCallView_button_accept"
                            onClick={onAccept}
                            title={_t("action|accept")}
                        >
                            <AcceptIcon />
                        </AccessibleButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Bespoke full-screen view for an incoming Element Call (MatrixRTC) notification. */
export function IncomingCallViewEC({
    notificationEvent,
    toastKey,
}: {
    notificationEvent: MatrixEvent;
    toastKey: string;
}): JSX.Element {
    // Accept joins immediately (onJoin = skipLobby: true) so "accept = in the call",
    // rather than dropping the user into Element Call's own lobby with a second
    // "Join" button. Per-device (mic/speaker/camera) selection is owned by Element
    // Call and cannot be driven from here; the only pre-join choice we can pass is
    // the audio/video intent, exposed via the video toggle below.
    const { room, isVoice, videoToggle, setVideoToggle, onJoin, onDecline } = useIncomingCallToast(
        notificationEvent,
        toastKey,
    );
    const videoToggleId = useId();

    return (
        <IncomingCallLayout
            room={room}
            title={room ? room.name : _t("voip|call_toast_unknown_room")}
            isVoice={isVoice}
            onAccept={onJoin}
            onDecline={(e) => void onDecline(e)}
        >
            {!isVoice && (
                <Form.Root
                    className="mx_IncomingCallView_videoToggle"
                    onSubmit={(evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                    }}
                >
                    <InlineField
                        name="videoToggle"
                        control={
                            <ToggleInput
                                id={videoToggleId}
                                checked={videoToggle}
                                onChange={(e) => setVideoToggle(e.target.checked)}
                            />
                        }
                    >
                        <Label htmlFor={videoToggleId}>{_t("voip|join_with_video")}</Label>
                    </InlineField>
                </Form.Root>
            )}
        </IncomingCallLayout>
    );
}

/** Bespoke full-screen view for an incoming legacy 1:1 (MatrixCall) call. */
export function IncomingCallViewLegacy({ call }: { call: MatrixCall }): JSX.Element | null {
    const { legacyCallHandler, client } = useContext(SDKContext);
    // Hooks must run unconditionally, before any early return.
    const silenced = useTypedEventEmitterState(legacyCallHandler, LegacyCallHandlerEvent.SilencedCallsChanged, () =>
        legacyCallHandler.isCallSilenced(call.callId),
    );

    const roomId = legacyCallHandler.roomIdForCall(call);
    if (!roomId) return null;
    const room = client?.getRoom(roomId) ?? undefined;
    const isVoice = call.type === CallType.Voice;

    const onAccept = (e: ButtonEvent): void => {
        e.stopPropagation();
        legacyCallHandler.answerCall(roomId);
    };
    const onDecline = (e: ButtonEvent): void => {
        e.stopPropagation();
        legacyCallHandler.hangupOrReject(roomId, true);
    };
    const onSilence = (e: ButtonEvent): void => {
        e.stopPropagation();
        if (silenced) {
            legacyCallHandler.unSilenceCall(call.callId);
        } else {
            legacyCallHandler.silenceCall(call.callId);
        }
    };

    return (
        <IncomingCallLayout
            room={room}
            title={room ? room.name : _t("voip|unknown_caller")}
            isVoice={isVoice}
            onAccept={onAccept}
            onDecline={onDecline}
            silence={{ silenced, disabled: legacyCallHandler.isForcedSilent(), onToggle: onSilence }}
        />
    );
}
