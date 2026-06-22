/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createContext } from "react";

import { type SdkContextClass } from "./SDKContextClass.ts";

export { type SdkContextClass } from "./SDKContextClass.ts";

// This context is available to components under MatrixChat,
// the context must not be used by components outside a SdkContextClass tree.
// This assertion allows us to make the type not nullable.
export const SDKContext = createContext<SdkContextClass>(null as any);
SDKContext.displayName = "SDKContext";
