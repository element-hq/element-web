/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// Populate this class with the details of your customisations when copying it.
import { Capability, Widget } from "matrix-widget-api";

/**
 * Approves the widget for capabilities that it requested, if any can be
 * approved. Typically this will be used to give certain widgets capabilities
 * without having to prompt the user to approve them. This cannot reject
 * capabilities that Element will be automatically granting, such as the
 * ability for Jitsi widgets to stay on screen - those will be approved
 * regardless.
 * @param {Widget} widget The widget to approve capabilities for.
 * @param {Set<Capability>} requestedCapabilities The capabilities the widget requested.
 * @returns {Set<Capability>} Resolves to the capabilities that are approved for use
 * by the widget. If none are approved, this should return an empty Set.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function preapproveCapabilities(
    widget: Widget,
    requestedCapabilities: Set<Capability>,
): Promise<Set<Capability>> {
    return new Set(); // no additional capabilities approved
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IWidgetPermissionCustomisations {
    preapproveCapabilities?: typeof preapproveCapabilities;
}

// A real customisation module will define and export one or more of the
// customisation points that make up the interface above.
export const WidgetPermissionCustomisations: IWidgetPermissionCustomisations = {};
