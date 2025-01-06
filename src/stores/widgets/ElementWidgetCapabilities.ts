/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

export enum ElementWidgetCapabilities {
    /**
     * @deprecated Use MSC2931 instead.
     */
    CanChangeViewedRoom = "io.element.view_room",
    /**
     * Ask Element to not give the option to move the widget into a separate tab.
     * This replaces RequiresClient in MatrixCapabilities.
     */
    RequiresClient = "io.element.requires_client",
}
