/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createContext } from "react";

import { type SDKContextClass } from "./SDKContextClass";

// This context is available to components under MatrixChat,
// the context must not be used by components outside a SDKContextClass tree.
// This assertion allows us to make the type not nullable.
// This file is deliberately kept separate from the actual instantiation of the
// stores to keep just a type import to the SDKContextClass itself.
export const SDKContext = createContext<SDKContextClass>(null as any);
SDKContext.displayName = "SDKContext";
