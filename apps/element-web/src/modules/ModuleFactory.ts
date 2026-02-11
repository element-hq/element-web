/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RuntimeModule } from "@matrix-org/react-sdk-module-api/lib/RuntimeModule";
import { type ModuleApi } from "@matrix-org/react-sdk-module-api/lib/ModuleApi";

export type ModuleFactory = (api: ModuleApi) => RuntimeModule;
