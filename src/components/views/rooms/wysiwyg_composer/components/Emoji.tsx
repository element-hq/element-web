/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { MenuProps } from "../../../../structures/ContextMenu";
import { EmojiButton } from "../../EmojiButton";
import dis from "../../../../../dispatcher/dispatcher";
import { ComposerInsertPayload } from "../../../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../../../dispatcher/actions";
import { useRoomContext } from "../../../../../contexts/RoomContext";

interface EmojiProps {
    menuPosition: MenuProps;
}

export function Emoji({ menuPosition }: EmojiProps): JSX.Element {
    const roomContext = useRoomContext();

    return (
        <EmojiButton
            menuPosition={menuPosition}
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
