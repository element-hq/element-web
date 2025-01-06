/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2021 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// Populate this class with the details of your customisations when copying it.
import { ITemplateParams } from "matrix-widget-api";

/**
 * Provides a partial set of the variables needed to render any widget. If
 * variables are missing or not provided then they will be filled with the
 * application-determined defaults.
 *
 * This will not be called until after isReady() resolves.
 * @returns {Partial<Omit<ITemplateParams, "widgetRoomId">>} The variables.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function provideVariables(): Partial<Omit<ITemplateParams, "widgetRoomId">> {
    return {};
}

/**
 * Resolves to whether or not the customisation point is ready for variables
 * to be provided. This will block widgets being rendered.
 * @returns {Promise<boolean>} Resolves when ready.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function isReady(): Promise<void> {
    return; // default no waiting
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IWidgetVariablesCustomisations {
    provideVariables?: typeof provideVariables;

    // If not provided, the app will assume that the customisation is always ready.
    isReady?: typeof isReady;
}

// A real customisation module will define and export one or more of the
// customisation points that make up the interface above.
export const WidgetVariableCustomisations: IWidgetVariablesCustomisations = {};
