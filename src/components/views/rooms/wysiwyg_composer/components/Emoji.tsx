/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
