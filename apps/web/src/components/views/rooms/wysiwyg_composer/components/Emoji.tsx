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
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { getCustomEmotesForRoom } from "../../../../../custom-emotes";

interface EmojiProps {
    menuPosition: MenuProps;
}

export function Emoji({ menuPosition }: EmojiProps): JSX.Element {
    const roomContext = useScopedRoomContext("room", "timelineRenderingType");
    const client = useMatrixClientContext();
    const customEmotes = roomContext.room ? getCustomEmotesForRoom(client, roomContext.room) : [];

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
            customEmotes={customEmotes}
            addCustomEmote={(customEmote) => {
                dis.dispatch<ComposerInsertPayload>({
                    action: Action.ComposerInsert,
                    customEmote,
                    timelineRenderingType: roomContext.timelineRenderingType,
                });
                return true;
            }}
        />
    );
}
