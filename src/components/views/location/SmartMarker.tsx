/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";

import type * as maplibregl from "maplibre-gl";
import { parseGeoUri } from "../../../utils/location";
import { createMarker } from "../../../utils/location/map";
import Marker from "./Marker";

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

export interface SmartMarkerProps {
    map: maplibregl.Map;
    geoUri: string;
    id?: string;
    // renders MemberAvatar when provided
    roomMember?: RoomMember;
    // use member text color as background
    useMemberColor?: boolean;
    tooltip?: ReactNode;
}

/**
 * Generic location marker
 */
const SmartMarker: React.FC<SmartMarkerProps> = ({ id, map, geoUri, roomMember, useMemberColor, tooltip }) => {
    const { onElementRef } = useMapMarker(map, geoUri);

    return (
        // maplibregl hijacks the Marker dom element
        // and removes it from the dom when the maplibregl.Marker instance
        // is removed
        // wrap in a span so that react doesn't get confused
        // when trying to unmount this component
        <span>
            <Marker
                ref={onElementRef}
                id={id}
                roomMember={roomMember}
                useMemberColor={useMemberColor}
                tooltip={tooltip}
            />
        </span>
    );
};

export default SmartMarker;
