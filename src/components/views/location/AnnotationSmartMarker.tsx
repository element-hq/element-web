/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode, useCallback, useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";

import { parseGeoUri } from "../../../utils/location";
import { createMarker } from "../../../utils/location/map";
import AnnotationMarker from "./AnnotationMarker";

const useMapMarker = (
    map: maplibregl.Map,
    geoUri: string,
): { marker?: maplibregl.Marker; onElementRef: (el: HTMLDivElement) => void } => {
    const [marker, setMarker] = useState<maplibregl.Marker>();

    const onElementRef = useCallback(
        (element: HTMLDivElement) => {
            if (marker || !element) {
                return;
            }
            const coords = parseGeoUri(geoUri);
            if (coords) {
                const newMarker = createMarker(coords, element);
                newMarker.addTo(map);
                setMarker(newMarker);
            }
        },
        [marker, geoUri, map],
    );

    useEffect(() => {
        if (marker) {
            const coords = parseGeoUri(geoUri);
            if (coords) {
                marker.setLngLat({ lon: coords.longitude, lat: coords.latitude });
            }
        }
    }, [marker, geoUri]);

    useEffect(
        () => () => {
            if (marker) {
                marker.remove();
            }
        },
        [marker],
    );

    return {
        marker,
        onElementRef,
    };
};

export interface AnnotationSmartMarkerProps {
    map: maplibregl.Map;
    geoUri: string;
    id: string;
    key: string;
    useColor?: string;
    tooltip?: ReactNode;
    onDelete: (key: string) => void;
}

/**
 * Generic location marker
 */
const AnnotationSmartMarker: React.FC<AnnotationSmartMarkerProps> = ({ id, map, geoUri, useColor, tooltip, onDelete }) => {
    const { onElementRef } = useMapMarker(map, geoUri);

    return (
        <span>
            <AnnotationMarker
                ref={onElementRef}
                id={id}
                useColor={useColor}
                tooltip={tooltip}
                onDelete={onDelete}
            />
        </span>
    );
};

export default AnnotationSmartMarker;
