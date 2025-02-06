/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useContext, useEffect, useState } from "react";
import classNames from "classnames";
import * as maplibregl from "maplibre-gl";
import { ClientEvent, type IClientWellKnown } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { parseGeoUri, positionFailureMessage } from "../../../utils/location";
import { tileServerFromWellKnown } from "../../../utils/WellKnownUtils";
import { useMap } from "../../../utils/location/useMap";
import { type Bounds } from "../../../utils/beacon/bounds";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import { _t } from "../../../languageHandler";

const useMapWithStyle = ({
    id,
    centerGeoUri,
    onError,
    interactive,
    bounds,
    allowGeolocate,
}: {
    id: string;
    centerGeoUri?: string;
    onError?(error: Error): void;
    interactive?: boolean;
    bounds?: Bounds;
    allowGeolocate?: boolean;
}): {
    map: maplibregl.Map | undefined;
    bodyId: string;
} => {
    const bodyId = `mx_Map_${id}`;

    // style config
    const context = useContext(MatrixClientContext);
    const mapStyleUrl = useEventEmitterState(
        context,
        ClientEvent.ClientWellKnown,
        (clientWellKnown: IClientWellKnown) => tileServerFromWellKnown(clientWellKnown)?.["map_style_url"],
    );

    const map = useMap({ interactive, bodyId, onError });

    useEffect(() => {
        if (mapStyleUrl && map) {
            map.setStyle(mapStyleUrl);
        }
    }, [mapStyleUrl, map]);

    useEffect(() => {
        if (map && centerGeoUri) {
            try {
                const coords = parseGeoUri(centerGeoUri);
                if (!coords) {
                    throw new Error("Invalid geo URI");
                }
                map.setCenter({ lon: coords.longitude, lat: coords.latitude });
            } catch (e) {
                logger.error("Could not set map center", e);
            }
        }
    }, [map, centerGeoUri]);

    useEffect(() => {
        if (map && bounds) {
            try {
                const lngLatBounds = new maplibregl.LngLatBounds(
                    [bounds.west, bounds.south],
                    [bounds.east, bounds.north],
                );
                map.fitBounds(lngLatBounds, { padding: 100, maxZoom: 15 });
            } catch (e) {
                logger.error("Invalid map bounds", e);
            }
        }
    }, [map, bounds]);

    const [geolocate, setGeolocate] = useState<maplibregl.GeolocateControl | null>(null);

    useEffect(() => {
        if (!map) {
            return;
        }
        if (allowGeolocate && !geolocate) {
            const geolocate = new maplibregl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true,
                },
                trackUserLocation: false,
            });
            setGeolocate(geolocate);
            map.addControl(geolocate);
        }
        if (!allowGeolocate && geolocate) {
            map.removeControl(geolocate);
            setGeolocate(null);
        }
    }, [map, geolocate, allowGeolocate]);

    useEffect(() => {
        if (geolocate) {
            geolocate.on("error", onGeolocateError);
            return () => {
                geolocate.off("error", onGeolocateError);
            };
        }
    }, [geolocate]);

    return {
        map,
        bodyId,
    };
};

const onGeolocateError = (e: GeolocationPositionError): void => {
    logger.error("Could not fetch location", e);
    Modal.createDialog(ErrorDialog, {
        title: _t("location_sharing|error_fetch_location"),
        description: positionFailureMessage(e.code) ?? "",
    });
};

export interface MapProps {
    id: string;
    interactive?: boolean;
    /**
     * set map center to geoUri coords
     * Center will only be set to valid geoUri
     * this prop is only simply diffed by useEffect, so to trigger *recentering* of the same geoUri
     * append the uri with a var not used by the geoUri spec
     * eg a timestamp: `geo:54,42;mxTs=123`
     */
    centerGeoUri?: string;
    bounds?: Bounds;
    className?: string;
    allowGeolocate?: boolean;
    onClick?: () => void;
    onError?: (error: Error) => void;
    children?: (renderProps: { map: maplibregl.Map }) => ReactNode;
}

const MapComponent: React.FC<MapProps> = ({
    bounds,
    centerGeoUri,
    children,
    className,
    allowGeolocate,
    id,
    interactive,
    onError,
    onClick,
}) => {
    const { map, bodyId } = useMapWithStyle({ centerGeoUri, onError, id, interactive, bounds, allowGeolocate });

    const onMapClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
        // Eat click events when clicking the attribution button
        const target = event.target as Element;
        if (target.classList.contains("maplibregl-ctrl-attrib-button")) {
            return;
        }

        onClick?.();
    };

    return (
        <div className={classNames("mx_Map", className)} id={bodyId} onClick={onMapClick}>
            {!!children && !!map && children({ map })}
        </div>
    );
};

export default MapComponent;
