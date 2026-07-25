/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { E2eMessageSharedIconView } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";

/**
 * Props for the {@link E2eMessageSharedIconAdapter} component.
 */
interface E2eMessageSharedIconAdapterProps {
    /** View model backing the shared-key indicator. */
    eventTileViewModel: EventTileViewModel;
    /** The ID of the room containing the event whose keys were shared. */
    roomId: string;
    /** The ID of the user who shared the keys. */
    keyForwardingUserId: string;
}

/**
 * Renders the end-to-end encryption key-sharing indicator.
 */
export function E2eMessageSharedIconAdapter({
    eventTileViewModel,
    roomId,
    keyForwardingUserId,
}: Readonly<E2eMessageSharedIconAdapterProps>): JSX.Element {
    const client = useMatrixClientContext();
    const vm = eventTileViewModel.getE2eMessageSharedIconViewModel({
        client,
        roomId,
        keyForwardingUserId,
    });

    useEffect(() => {
        // This child VM owns Matrix listeners, so release it when the view using it leaves the tree.
        return () => eventTileViewModel.releaseE2eMessageSharedIconViewModel();
    }, [eventTileViewModel]);

    useEffect(() => {
        vm.setClient(client);
    }, [client, vm]);

    useEffect(() => {
        vm.setRoomId(roomId);
    }, [roomId, vm]);

    useEffect(() => {
        vm.setKeyForwardingUserId(keyForwardingUserId);
    }, [keyForwardingUserId, vm]);

    return (
        <E2eMessageSharedIconView
            vm={vm}
            className={
                // Timeline PCSS uses this app class as a layout hook for positioning and layout variants.
                "mx_EventTile_e2eIcon"
            }
        />
    );
}
