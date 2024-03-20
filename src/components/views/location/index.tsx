/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Exports location components which touch maplibre-gs wrapped in React Suspense to enable code splitting

import React, { ComponentProps, lazy, Suspense } from "react";

import Spinner from "../elements/Spinner";

const MapComponent = lazy(() => import("./Map"));

export function Map(props: ComponentProps<typeof MapComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <MapComponent {...props} />
        </Suspense>
    );
}

const LocationPickerComponent = lazy(() => import("./LocationPicker"));

export function LocationPicker(props: ComponentProps<typeof LocationPickerComponent>): JSX.Element {
    return (
        <Suspense fallback={<Spinner />}>
            <LocationPickerComponent {...props} />
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
