/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, useEffect, useState } from "react";

import type { Room } from "matrix-js-sdk/src/matrix";
import { type MessagePreview, MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { useEventEmitter } from "../../../hooks/useEventEmitter";

interface MessagePreviewViewState {
    /**
     * A string representation of the message preview if available.
     */
    message?: string;
}

/**
 * View model for rendering a message preview for a given room list item.
 * @param room The room for which we're rendering the message preview.
 * @see {@link MessagePreviewViewState} for what this view model returns.
 */
export function useMessagePreviewViewModel(room: Room): MessagePreviewViewState {
    const [messagePreview, setMessagePreview] = useState<MessagePreview | null>(null);

    const updatePreview = useCallback(async (): Promise<void> => {
        /**
         * The second argument to getPreviewForRoom is a tag id which doesn't really make
         * much sense within the context of the new room list. We can pass an empty string
         * to match all tags for now but we should remember to actually change the implementation
         * in the store once we remove the legacy room list.
         */
        const newPreview = await MessagePreviewStore.instance.getPreviewForRoom(room, "");
        setMessagePreview(newPreview);
    }, [room]);

    /**
     * Update when the message preview has changed for this room.
     */
    useEventEmitter(MessagePreviewStore.instance, MessagePreviewStore.getPreviewChangedEventName(room), () => {
        updatePreview();
    });

    /**
     * Do an initial fetch of the message preview.
     */
    useEffect(() => {
        updatePreview();
    }, [updatePreview]);

    return {
        message: messagePreview?.text,
    };
}
