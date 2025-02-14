/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type PropsWithChildren } from "react";

import type React from "react";

declare module "react" {
    // Fix forwardRef types for Generic components - https://stackoverflow.com/a/58473012
    function forwardRef<T, P extends object>(
        render: (props: PropsWithChildren<P>, ref: React.ForwardedRef<T>) => React.ReactElement | null,
    ): (props: P & React.RefAttributes<T>) => React.ReactElement | null;

    // Fix lazy types - https://stackoverflow.com/a/71017028
    function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): T;
}
