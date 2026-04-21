/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- optional interface, will gracefully degrade to `any` if `react-sdk-module-api` isn't installed
import type { ModuleApi, RuntimeModule } from "@matrix-org/react-sdk-module-api";

/**
 * @alpha
 * @deprecated in favour of the new module API
 */
export type RuntimeModuleConstructor = new (api: ModuleApi) => RuntimeModule;

/**
 * @alpha
 * @deprecated in favour of the new module API
 */
/* eslint-disable @typescript-eslint/naming-convention */
export interface LegacyModuleApiExtension {
    /**
     * Register a legacy module based on \@matrix-org/react-sdk-module-api
     * @param LegacyModule - the module class to register
     * @deprecated provided only as a transition path for legacy modules
     */
    _registerLegacyModule(LegacyModule: RuntimeModuleConstructor): Promise<void>;
}
