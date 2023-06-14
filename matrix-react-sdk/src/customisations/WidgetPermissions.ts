/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
