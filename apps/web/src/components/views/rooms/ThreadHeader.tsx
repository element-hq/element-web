/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useState } from "react";
import { MatrixEventEvent, type MatrixEvent, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { Text, IconButton } from "@vector-im/compound-web";
import { Flex } from "@element-hq/web-shared-components";
import ChevronLeftIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-left";

import { _t } from "../../../languageHandler";
import { useRoomName } from "../../../hooks/useRoomName";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { MessagePreviewStore } from "../../../stores/message-preview";
import RoomAvatar from "../avatars/RoomAvatar";
import PosthogTrackers from "../../../PosthogTrackers";
import { type ButtonEvent } from "../elements/AccessibleButton";
import { RoomHeaderButtons } from "./RoomHeader/RoomHeader";
import { CurrentRightPanelPhaseContextProvider } from "../../../contexts/CurrentRightPanelPhaseContext";

interface Props {
    /** The room the thread belongs to; supplies the avatar and the header's actions. */
    room: Room;
    /** The thread's root event, previewed on the second header line. */
    threadRoot: MatrixEvent;
    /** Leave the thread and restore the room timeline. */
    onBack: () => void;
}

/**
 * Header for a thread shown full-size in the room's main split: a back affordance naming the room
 * it returns to, the thread's identity over a preview of the message it started from, and the room
 * header's own actions, so the threads list and the room's panels stay reachable from inside a thread.
 */
export const ThreadHeader: React.FC<Props> = ({ room, threadRoot, onBack }): JSX.Element => {
    const roomName = useRoomName(room);

    const [preview, setPreview] = useState(() => MessagePreviewStore.instance.generatePreviewForEvent(threadRoot));
    const refreshPreview = useCallback(
        () => setPreview(MessagePreviewStore.instance.generatePreviewForEvent(threadRoot)),
        [threadRoot],
    );
    useEffect(refreshPreview, [refreshPreview]);
    useTypedEventEmitter(threadRoot, MatrixEventEvent.Decrypted, refreshPreview);
    useTypedEventEmitter(threadRoot, MatrixEventEvent.Replaced, refreshPreview);
    useTypedEventEmitter(room, RoomEvent.Redaction, refreshPreview);

    const onClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebThreadViewBackButton", ev);
        onBack();
    };

    return (
        <CurrentRightPanelPhaseContextProvider roomId={room.roomId}>
            <Flex as="header" align="center" gap="var(--cpd-space-3x)" className="mx_ThreadHeader light-panel">
                <IconButton
                    size="32px"
                    kind="secondary"
                    onClick={onClick}
                    tooltip={_t("room|thread_header_back_label", { roomName })}
                >
                    <ChevronLeftIcon />
                </IconButton>
                <RoomAvatar room={room} size="32px" aria-hidden={true} />
                <div
                    className="mx_ThreadHeader_info"
                    role="heading"
                    aria-level={1}
                    aria-label={
                        preview
                            ? _t("room|thread_header_a11y_label_with_message", { roomName, message: preview })
                            : _t("room|thread_header_a11y_label", { roomName })
                    }
                >
                    <Text as="div" size="md" weight="semibold">
                        {_t("common|thread")}
                    </Text>
                    <Text as="div" size="sm" weight="regular" dir="auto" className="mx_ThreadHeader_root mx_lineClamp">
                        {preview || roomName}
                    </Text>
                </div>
                <RoomHeaderButtons room={room} />
            </Flex>
        </CurrentRightPanelPhaseContextProvider>
    );
};
