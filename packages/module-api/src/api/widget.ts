/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IWidget } from "matrix-widget-api";

/**
 * Containers that control where a widget is displayed on the screen.
 *
 * "top" is the app drawer, and currently the only sensible value.
 *
 * "right" is the right panel, and the default for widgets. Setting
 * this as a container on a widget is essentially like saying "no
 * changes needed", though this may change in the future.
 *
 * "center" was uncodumented at time of porting this from an enum.
 * Possibly when a widget replaces the main chat view like element call.
 *
 * @alpha Subject to change.
 */
export type Container = "top" | "right" | "center";

/**
 * An API for interfacing with widgets in Element Web, including getting what widgets
 * are active in a given room.
 * @alpha Subject to change.
 */
export interface WidgetApi {
    /**
     * Gets the widgets active in a given room.
     *
     * @param roomId - The room to get the widgets for.
     */
    getWidgetsInRoom(roomId: string): IWidget[];

    /**
     * Gets the URL of a widget's avatar, if it has one.
     *
     * @param app - The widget to get the avatar URL for.
     * @param width - Optional width to resize the avatar to.
     * @param height - Optional height to resize the avatar to.
     * @param resizeMethod - Optional method to use when resizing the avatar.
     * @returns The URL of the widget's avatar, or null if it doesn't have one.
     */
    getAppAvatarUrl(app: IWidget, width?: number, height?: number, resizeMethod?: string): string | null;

    /**
     * Checks if a widget is in a specific container in a given room.
     *
     * @param app - The widget to check.
     * @param container - The container to check.
     * @param roomId - The room to check in.
     * @returns True if the widget is in the specified container, false otherwise.
     */
    isAppInContainer(app: IWidget, container: Container, roomId: string): boolean;

    /**
     * Moves a widget to a specific container in a given room.
     *
     * @param app - The widget to move.
     * @param container - The container to move the widget to.
     * @param roomId - The room to move the widget in.
     */
    moveAppToContainer(app: IWidget, container: Container, roomId: string): void;
}
