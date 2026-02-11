/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentType } from "react";

declare module "react" {
    // Fix lazy types - https://stackoverflow.com/a/71017028
    function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): T;

    // Standardize defaultProps for FunctionComponent so we can write generics assuming `defaultProps` exists on ComponentType
    interface FunctionComponent {
        defaultProps?: unknown;
    }
}
