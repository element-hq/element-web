/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { RoomListPanel as SharedRoomListPanel } from "@element-hq/web-shared-components";

import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { Landmark, LandmarkNavigation } from "../../../../accessibility/LandmarkNavigation";
import { type IState as IRovingTabIndexState } from "../../../../accessibility/RovingTabIndex";
import { RoomListPanelViewModel } from "../../../viewmodels/roomlist/RoomListPanelViewModel";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import RoomAvatar from "../../avatars/RoomAvatar";
import type { RoomListItem } from "@element-hq/web-shared-components";

type RoomListPanelProps = {
    /**
     * Current active space
     * This is kept for backward compatibility but not currently used by the ViewModel
     */
    activeSpace: string;
};

/**
 * The panel of the room list
 */
export const RoomListPanel: React.FC<RoomListPanelProps> = ({ activeSpace }) => {
    const client = useMatrixClientContext();
    const [focusedElement, setFocusedElement] = useState<Element | null>(null);

    // Create ViewModel instance - use ref to survive strict mode double-mounting
    const vmRef = useRef<RoomListPanelViewModel | null>(null);
    if (!vmRef.current) {
        vmRef.current = new RoomListPanelViewModel({ client });
    }
    const vm = vmRef.current;

    // Clean up ViewModel on unmount
    useEffect(() => {
        return () => {
            vm.dispose();
            vmRef.current = null;
        };
    }, [vm]);

    const onFocus = useCallback((ev: React.FocusEvent): void => {
        setFocusedElement(ev.target as Element);
    }, []);

    const onBlur = useCallback((): void => {
        setFocusedElement(null);
    }, []);

    const onKeyDown = useCallback(
        (ev: React.KeyboardEvent, state?: IRovingTabIndexState): void => {
            if (!focusedElement) return;
            const navAction = getKeyBindingsManager().getNavigationAction(ev);
            if (navAction === KeyBindingAction.PreviousLandmark || navAction === KeyBindingAction.NextLandmark) {
                ev.stopPropagation();
                ev.preventDefault();
                LandmarkNavigation.findAndFocusNextLandmark(
                    Landmark.ROOM_SEARCH,
                    navAction === KeyBindingAction.PreviousLandmark,
                );
            }
        },
        [focusedElement],
    );

    // Render avatar for room items
    const renderAvatar = useCallback(
        (roomItem: RoomListItem) => {
            // Get the actual room from the client
            const room = client.getRoom(roomItem.id);
            if (!room) return null;
            return <RoomAvatar room={room} size="32px" />;
        },
        [client],
    );

    return (
        <SharedRoomListPanel
            vm={vm}
            renderAvatar={renderAvatar}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
        />
    );
};
