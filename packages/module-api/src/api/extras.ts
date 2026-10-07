/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentType, type JSX, type SVGAttributes } from "react";

/**
 * Properties of an item added to the Space panel
 * @alpha
 */
export interface SpacePanelItemProps {
    /**
     * A CSS class name for the item
     */
    className?: string;

    /**
     * An icon to show in the item. If not provided, no icon will be shown.
     */
    icon?: JSX.Element;

    /**
     * The label to show in the item
     */
    label: string;

    /**
     * A tooltip to show when hovering over the item
     */
    tooltip?: string;

    /**
     * Styles to apply to the item
     */
    style?: React.CSSProperties;

    /**
     * Callback when the item is selected
     */
    onSelected: () => void;
}

/**
 * A callback that returns a JSX element representing the buttons.
 *
 * @alpha
 * @param roomId - The ID of the room for which the header is being rendered.
 * @returns A JSX element representing the buttons to be rendered in the room header, or undefined if no buttons should be rendered.
 */
export type RoomHeaderButtonsCallback = (roomId: string) => JSX.Element | undefined;

/**
 * An action added by a module to a room UI surface, such as the room info panel or the member list header.
 * @alpha
 */
export interface RoomAction {
    /**
     * A key to identify this action. Must be unique among the actions shown for a room.
     */
    key: string;

    /**
     * The label of the action. Also used as the tooltip when the action is shown as an icon-only button.
     */
    label: string;

    /**
     * The icon of the action.
     */
    icon: ComponentType<SVGAttributes<SVGElement>>;

    /**
     * Callback when the action is clicked.
     */
    onClick: () => void;

    /**
     * Whether the action is disabled.
     */
    disabled?: boolean;

    /**
     * Tooltip shown when the action is disabled, to explain why. No tooltip is shown when not set.
     */
    disabledTooltip?: string;
}

/**
 * A callback that returns the action to show for a room.
 *
 * @alpha
 * @param roomId - The ID of the room for which the action is being rendered.
 * @returns The action to show, or undefined if no action should be shown for this room.
 */
export type RoomActionCallback = (roomId: string) => RoomAction | undefined;

/**
 * API for inserting extra UI into Element Web.
 * @alpha Subject to change.
 */
export interface ExtrasApi {
    /**
     * Inserts an item into the space panel as if it were a space button, below
     * buttons for other spaces.
     * If called again with the same spaceKey, will update the existing item.
     * @param spaceKey - A key to identify this space-like item.
     * @param props - Properties of the item to add.
     */
    setSpacePanelItem(spaceKey: string, props: SpacePanelItemProps): void;

    /**
     * Registers a callback to get the list of visible rooms for a given space.
     *
     * Element Web will call this callback when checking if a room is displayed for the given space. For example in case of message editing or replying.
     * If the space added by the module displays a room view and doesn't provide this callback, Element Web won't be able to determine if a room is visible in that space and will redirect to display the room in its vanilla space/metaspace.
     *
     * @param spaceKey - The space key to get visible rooms for.
     * @param cb - A callback that returns the list of visible room IDs.
     */
    getVisibleRoomBySpaceKey(spaceKey: string, cb: () => string[]): void;

    /**
     * Adds a callback to get extra buttons in the room header (which can vary depending on the room being displayed).
     *
     * @param cb - A callback that returns a JSX element representing the buttons (see {@link RoomHeaderButtonsCallback}).
     */
    addRoomHeaderButtonCallback(cb: RoomHeaderButtonsCallback): void;

    /**
     * Adds a callback to get an extra action shown in the room info panel.
     *
     * @param cb - A callback that returns the action to show (see {@link RoomActionCallback}).
     */
    addRoomSummaryCardActionCallback(cb: RoomActionCallback): void;

    /**
     * Adds a callback to get an extra button shown in the member list header.
     *
     * @param cb - A callback that returns the action to show (see {@link RoomActionCallback}).
     */
    addMemberListHeaderActionCallback(cb: RoomActionCallback): void;
}
