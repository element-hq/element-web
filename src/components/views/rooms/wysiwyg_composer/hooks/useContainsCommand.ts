/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { useEffect, useState, useRef } from "react";

import CommandProvider from "../../../../../autocomplete/CommandProvider";

/**
 * A hook which determines if the given content contains a slash command.
 * @returns true if the content contains a slash command, false otherwise.
 * @param content The content to check for commands.
 * @param room The current room.
 */
export function useContainsCommand(content: string | null, room: Room | undefined): boolean {
    const [contentContainsCommands, setContentContainsCommands] = useState(false);
    const providerRef = useRef<CommandProvider | null>(null);
    const currentRoomIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!room || !content) {
            setContentContainsCommands(false);
            return;
        }

        // Create or reuse CommandProvider for the current room
        if (!providerRef.current || currentRoomIdRef.current !== room.roomId) {
            providerRef.current = new CommandProvider(room);
            currentRoomIdRef.current = room.roomId;
        }

        const provider = providerRef.current;
        provider
            .getCompletions(content, { start: 0, end: 0 })
            .then((results) => {
                if (results.length > 0) {
                    setContentContainsCommands(true);
                } else {
                    setContentContainsCommands(false);
                }
            })
            .catch(() => {
                // If there's an error getting completions, assume no commands
                setContentContainsCommands(false);
            });
    }, [content, room]);

    return contentContainsCommands;
}
