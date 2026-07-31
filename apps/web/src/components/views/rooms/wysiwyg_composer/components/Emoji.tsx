/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { type MenuProps } from "../../../../structures/ContextMenu";
import { EmojiButton } from "../../EmojiButton";
import dis from "../../../../../dispatcher/dispatcher";
import { type ComposerInsertPayload } from "../../../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../../../dispatcher/actions";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";
import { useComposerContext } from "../ComposerContext";

interface EmojiProps {
    menuPosition: MenuProps;
}

export function Emoji({ menuPosition }: EmojiProps): JSX.Element {
    const roomContext = useScopedRoomContext("room", "replyToEvent", "timelineRenderingType");
    const { eventRelation } = useComposerContext();

    return (
        <EmojiButton
            menuPosition={menuPosition}
            room={roomContext.room}
            relation={eventRelation}
            replyToEvent={roomContext.replyToEvent}
            timelineRenderingType={roomContext.timelineRenderingType}
            addEmoji={(emoji) => {
                dis.dispatch<ComposerInsertPayload>({
                    action: Action.ComposerInsert,
                    text: emoji,
                    timelineRenderingType: roomContext.timelineRenderingType,
                });
                return true;
            }}
        />
    );
}
