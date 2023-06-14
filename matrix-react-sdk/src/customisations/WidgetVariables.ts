/*
 * Copyright 2021 The Matrix.org Foundation C.I.C.
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
import { ITemplateParams } from "matrix-widget-api";

/**
 * Provides a partial set of the variables needed to render any widget. If
 * variables are missing or not provided then they will be filled with the
 * application-determined defaults.
 *
 * This will not be called until after isReady() resolves.
 * @returns {Partial<Omit<ITemplateParams, "widgetRoomId">>} The variables.
 */
function provideVariables(): Partial<Omit<ITemplateParams, "widgetRoomId">> {
    return {};
}

/**
 * Resolves to whether or not the customisation point is ready for variables
 * to be provided. This will block widgets being rendered.
 * @returns {Promise<boolean>} Resolves when ready.
 */
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
