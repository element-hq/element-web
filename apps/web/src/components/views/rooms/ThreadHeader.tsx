/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { Text, IconButton } from "@vector-im/compound-web";
import { Flex } from "@element-hq/web-shared-components";
import ChevronLeftIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-left";

import { _t } from "../../../languageHandler";
import { useRoomName } from "../../../hooks/useRoomName";
import RoomAvatar from "../avatars/RoomAvatar";
import PosthogTrackers from "../../../PosthogTrackers";
import { type ButtonEvent } from "../elements/AccessibleButton";

interface Props {
    /** The room the thread belongs to; supplies the avatar and the second header line. */
    room: Room;
    /** Leave the thread and restore the room timeline. */
    onBack: () => void;
}

/**
 * Header for a thread shown full-size in the room's main split: a back affordance, the room avatar,
 * and the thread's identity over the room name. Deliberately carries no actions, so the header reads
 * as a thread rather than as the room it replaced.
 */
export const ThreadHeader: React.FC<Props> = ({ room, onBack }): JSX.Element => {
    const roomName = useRoomName(room);

    const onClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebThreadViewBackButton", ev);
        onBack();
    };

    return (
        <Flex as="header" align="center" gap="var(--cpd-space-3x)" className="mx_ThreadHeader light-panel">
            <IconButton size="32px" kind="secondary" onClick={onClick} tooltip={_t("action|back")}>
                <ChevronLeftIcon />
            </IconButton>
            <RoomAvatar room={room} size="32px" aria-hidden={true} />
            <div
                className="mx_ThreadHeader_info"
                role="heading"
                aria-level={1}
                aria-label={_t("room|thread_header_a11y_label", { roomName })}
            >
                <Text as="div" size="md" weight="semibold">
                    {_t("common|thread")}
                </Text>
                <Text as="div" size="sm" weight="regular" dir="auto" className="mx_ThreadHeader_roomName mx_lineClamp">
                    {roomName}
                </Text>
            </div>
        </Flex>
    );
};
