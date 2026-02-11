/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Exports beacon components which touch maplibre-gs wrapped in React Suspense to enable code splitting

import React, { type JSX, type ComponentProps, lazy, Suspense } from "react";

import Spinner from "../elements/Spinner";

const BeaconViewDialogComponent = lazy(() => import("./BeaconViewDialog"));

export function BeaconViewDialog(props: ComponentProps<typeof BeaconViewDialogComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <BeaconViewDialogComponent {...props} />
        </Suspense>
    );
}
