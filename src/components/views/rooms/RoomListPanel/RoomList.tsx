/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX, useEffect, useRef, type RefObject } from "react";
import { AutoSizer, List, type ListRowProps } from "react-virtualized";
import { type Room } from "matrix-js-sdk/src/matrix";

import { type RoomListViewState } from "../../../viewmodels/roomlist/RoomListViewModel";
import { _t } from "../../../../languageHandler";
import { RoomListCell } from "./RoomListCell";

interface RoomListProps {
    /**
     * The view model state for the room list.
     */
    vm: RoomListViewState;
}

/**
 * A virtualized list of rooms.
 */
export function RoomList({ vm: { rooms, openRoom } }: RoomListProps): JSX.Element {
    const roomRendererMemoized = useCallback(
        ({ key, index, style }: ListRowProps) => (
            <RoomListCell
                room={rooms[index]}
                key={key}
                style={style}
                aria-setsize={rooms.length}
                aria-posinset={index + 1}
                onClick={() => openRoom(rooms[index].roomId)}
            />
        ),
        [rooms, openRoom],
    );

    const ref = useAccessibleList(rooms);

    // The first div is needed to make the virtualized list take all the remaining space and scroll correctly
    return (
        <div className="mx_RoomList" data-testid="room-list" ref={ref}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        aria-label={_t("room_list|list_title")}
                        className="mx_RoomList_List"
                        rowRenderer={roomRendererMemoized}
                        rowCount={rooms.length}
                        rowHeight={48}
                        height={height}
                        width={width}
                        role="listbox"
                    />
                )}
            </AutoSizer>
        </div>
    );
}

/**
 * Make the list of rooms accessible. The ref should be put on the list node.
 *
 * The list rendered by react-virtualized has not the best role and attributes for accessibility.
 * The react-virtualized list has the following a11y attributes: "grid" -> "row" -> ["gridcell", "gridcell", "gridcell"].
 * Using a grid role is not the best choice for a list of items, we want instead a listbox role with children having an option role.
 *
 * The listbox and option roles can be set directly in the jsx of the `List` and the `RoomListCell` component but the "gridcell" role is remaining.
 * This hook removes the "gridcell" role from the list items and set "aria-setsize" on the list too.
 *
 * @returns The ref to put on the list node.
 */
function useAccessibleList(rooms: Room[]): RefObject<HTMLDivElement> {
    // To be put on the list node
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const list = ref.current?.querySelector('[role="listbox"]');
        if (!list) return;

        // Determine if a node is a row node
        const isRowNode = (node: HTMLElement): boolean => node.getAttribute("role") === "row";

        // Watch the node with the "row" role to be added to the dom and remove the role
        // If the role is re-added/modified later, we remove it too
        const observer = new MutationObserver((mutationList) => {
            for (const mutation of mutationList) {
                if (mutation.type === "childList") {
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof HTMLElement && isRowNode(node)) {
                            node.removeAttribute("role");
                        }
                    });
                } else if (
                    mutation.type === "attributes" &&
                    mutation.target instanceof HTMLElement &&
                    isRowNode(mutation.target)
                ) {
                    mutation.target.removeAttribute("role");
                }
            }
        });
        observer.observe(list, { childList: true, subtree: true, attributeFilter: ["role"] });
        return () => observer.disconnect();
    }, [rooms]);

    return ref;
}
