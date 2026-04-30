/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useMemo, type MouseEvent } from "react";

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import type { EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";

type UseEventTileCommandsProps = {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
};

/** Event handlers and room data returned from `useEventTileCommands`. */
type UseEventTileCommandsResult = {
    room: Room | null;
    openInRoom: (_anchor: HTMLElement | null) => void;
    copyLinkToThread: (_anchor: HTMLElement | null) => Promise<void>;
    onPermalinkClicked: (ev: MouseEvent<HTMLElement>) => void;
    onListTileClick: (ev: MouseEvent<HTMLElement>) => void;
    onContextMenu: (ev: MouseEvent<HTMLElement>) => void;
    onPermalinkContextMenu: (ev: MouseEvent<HTMLElement>) => void;
};

export function useEventTileCommands(
    props: UseEventTileCommandsProps,
    cli: MatrixClient,
    vm: EventTileViewModel,
): UseEventTileCommandsResult {
    const roomId = props.mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;

    const onPermalinkClicked = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            vm.onPermalinkClicked(ev);
        },
        [vm],
    );
    const openInRoom = useCallback(
        (_anchor: HTMLElement | null): void => {
            vm.openInRoom();
        },
        [vm],
    );
    const copyLinkToThread = useCallback(
        async (_anchor: HTMLElement | null): Promise<void> => {
            await vm.copyLinkToThread();
        },
        [vm],
    );
    const onContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            vm.openContextMenu(ev);
        },
        [vm],
    );
    const onPermalinkContextMenu = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            const eventId = props.mxEvent.getId();
            vm.openContextMenu(ev, eventId ? props.permalinkCreator?.forEvent(eventId) : undefined);
        },
        [vm, props.permalinkCreator, props.mxEvent],
    );
    const onListTileClick = useCallback(
        (ev: MouseEvent<HTMLElement>): void => {
            const target = ev.currentTarget;
            let index = -1;
            if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

            vm.onListTileClick(ev.nativeEvent, index);
        },
        [vm],
    );

    return useMemo(
        () => ({
            room,
            onPermalinkClicked,
            openInRoom,
            copyLinkToThread,
            onContextMenu,
            onPermalinkContextMenu,
            onListTileClick,
        }),
        [
            room,
            onPermalinkClicked,
            openInRoom,
            copyLinkToThread,
            onContextMenu,
            onPermalinkContextMenu,
            onListTileClick,
        ],
    );
}
