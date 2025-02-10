/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Exports location components which touch maplibre-gs wrapped in React Suspense to enable code splitting

import React, { type ComponentProps, lazy, Suspense } from "react";

import Spinner from "../elements/Spinner";

const MapComponent = lazy(() => import("./Map"));

export function Map(props: ComponentProps<typeof MapComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <MapComponent {...props} />
        </Suspense>
    );
}

const SmartMarkerComponent = lazy(() => import("./SmartMarker"));

export function SmartMarker(props: ComponentProps<typeof SmartMarkerComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <SmartMarkerComponent {...props} />
        </Suspense>
    );
}

const LocationButtonComponent = lazy(() => import("./LocationButton"));

export function LocationButton(props: ComponentProps<typeof LocationButtonComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <LocationButtonComponent {...props} />
        </Suspense>
    );
}

const LocationViewDialogComponent = lazy(() => import("./LocationViewDialog"));

export function LocationViewDialog(props: ComponentProps<typeof LocationViewDialogComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <LocationViewDialogComponent {...props} />
        </Suspense>
    );
}
