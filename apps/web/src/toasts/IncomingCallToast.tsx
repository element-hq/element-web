/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, type ComponentType, type SVGAttributes, useId } from "react";
import { AvatarStack, Button, Form, Heading, InlineField, Label, ToggleInput, Tooltip } from "@vector-im/compound-web";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    CheckIcon,
    CloseIcon,
    ExpandIcon,
    VideoCallSolidIcon,
    VoiceCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { AvatarWithDetails } from "@element-hq/web-shared-components";

import { _t } from "../languageHandler";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import AccessibleButton, { type ButtonEvent } from "../components/views/elements/AccessibleButton";
import { useIncomingCallToast } from "../hooks/useIncomingCallToast";
import MemberAvatar from "../components/views/avatars/MemberAvatar";

// Re-exported for backwards compatibility with existing importers.
export { getNotificationEventSendTs } from "../hooks/useIncomingCallToast";

/**
 * Get the key for the incoming call toast. A combination of the call ID and room ID.
 */
export const getIncomingCallToastKey = (callId: string, roomId: string): string => `call_${callId}_${roomId}`;

interface JoinCallButtonWithCallProps {
    onClick: (e: ButtonEvent) => void;
    disabledTooltip: string | undefined;
}

function JoinCallButtonWithCall({ onClick, disabledTooltip }: JoinCallButtonWithCallProps): JSX.Element {
    const button = (
        <Button
            className="mx_IncomingCallToast_actionButton"
            onClick={onClick}
            disabled={disabledTooltip != undefined}
            kind="primary"
            Icon={CheckIcon}
            size="md"
        >
            {_t("action|join")}
        </Button>
    );

    return disabledTooltip === undefined ? button : <Tooltip description={disabledTooltip}>{button}</Tooltip>;
}

interface Props {
    /**
     * A MatrixRTC notification event which has a content type of `IRTCNotificationContent`
     */
    notificationEvent: MatrixEvent;
    /**
     * The unique key of the toast notification, used to dismiss the toast if the
     * notification expires for any reason.
     */
    toastKey: string;
}

export function IncomingCallToast({ notificationEvent, toastKey }: Props): JSX.Element {
    const {
        room,
        isVoice,
        isRing,
        otherUserId,
        members,
        otherCallIsOngoing,
        videoToggle,
        setVideoToggle,
        onJoin,
        onExpand,
        onDecline,
    } = useIncomingCallToast(notificationEvent, toastKey);
    const videoToggleId = useId();

    const avatars = (): ReactNode => (
        <AvatarStack className="mx_IncomingCallToast_avatars">
            {members.slice(0, 3).map((m) => (
                <MemberAvatar key={m.userId} size="20px" member={m} aria-label={m.name} />
            ))}
        </AvatarStack>
    );

    let detailsInformation: ReactNode;
    if (isRing) {
        detailsInformation = <span>{otherUserId}</span>;
    } else if (members.length > 0) {
        detailsInformation =
            members.length > 3
                ? _t(
                      "voip|call_members|overflow",
                      { count: members.length, overflowCount: members.length - 3 },
                      { avatars },
                  )
                : _t("voip|call_members|exhaustive", { count: members.length }, { avatars });
    }

    let title: string;
    let Icon: ComponentType<SVGAttributes<SVGElement>>;
    let iconLabel: string;
    // Special title for group calls
    if (otherUserId === undefined) title = _t("voip|group_call_started");
    if (isVoice) {
        title ??= _t("voip|voice_call_incoming");
        Icon = VoiceCallSolidIcon;
        iconLabel = _t("voip|voice_call");
    } else {
        title ??= _t("voip|video_call_incoming");
        Icon = VideoCallSolidIcon;
        iconLabel = _t("voip|video_call");
    }

    return (
        <div className="mx_IncomingCallToast_content">
            <div className="mx_IncomingCallToast_title">
                <Icon aria-label={iconLabel} width={20} height={20} />
                <Heading as="h2" type="body" size="lg" weight="semibold">
                    {title}
                </Heading>
                <AccessibleButton
                    className="mx_IncomingCallToast_expandButton"
                    onClick={onExpand}
                    title={_t("action|expand")}
                >
                    <ExpandIcon width={16} height={16} aria-hidden />
                </AccessibleButton>
            </div>
            <AvatarWithDetails
                avatar={<RoomAvatar room={room ?? undefined} size="40px" />}
                details={detailsInformation}
                title={room ? room.name : _t("voip|call_toast_unknown_room")}
                className="mx_IncomingCallToast_AvatarWithDetails"
            />
            {!isVoice && (
                <Form.Root
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
            <div className="mx_IncomingCallToast_buttons">
                <Button
                    className="mx_IncomingCallToast_actionButton"
                    onClick={(e) => {
                        void onDecline(e);
                    }}
                    kind="secondary"
                    Icon={CloseIcon}
                    size="md"
                >
                    {_t("action|decline")}
                </Button>
                <JoinCallButtonWithCall
                    onClick={onJoin}
                    disabledTooltip={otherCallIsOngoing ? "Ongoing call" : undefined}
                />
            </div>
        </div>
    );
}
