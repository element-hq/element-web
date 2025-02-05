/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, useEffect } from "react";
import { type MatrixClient, type Beacon, type Room } from "matrix-js-sdk/src/matrix";

import type * as maplibregl from "maplibre-gl";
import { Icon as LiveLocationIcon } from "../../../../res/img/location/live-location.svg";
import { useLiveBeacons } from "../../../utils/beacon/useLiveBeacons";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BaseDialog from "../dialogs/BaseDialog";
import Map from "../location/Map";
import ZoomButtons from "../location/ZoomButtons";
import BeaconMarker from "./BeaconMarker";
import { type Bounds, getBeaconBounds } from "../../../utils/beacon/bounds";
import { getGeoUri } from "../../../utils/beacon";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import DialogSidebar from "./DialogSidebar";
import DialogOwnBeaconStatus from "./DialogOwnBeaconStatus";
import BeaconStatusTooltip from "./BeaconStatusTooltip";
import MapFallback from "../location/MapFallback";
import { MapError } from "../location/MapError";
import { type LocationShareError } from "../../../utils/location";

export interface IProps {
    roomId: Room["roomId"];
    matrixClient: MatrixClient;
    // open the map centered on this beacon's location
    initialFocusedBeacon?: Beacon;
    onFinished(): void;
}

// track the 'focused time' as ts
// to make it possible to refocus the same beacon
// as the beacon location may change
// or the map may move around
interface FocusedBeaconState {
    ts: number;
    beacon?: Beacon;
}

const getBoundsCenter = (bounds?: Bounds): string | undefined => {
    if (!bounds) {
        return;
    }
    return getGeoUri({
        latitude: (bounds.north + bounds.south) / 2,
        longitude: (bounds.east + bounds.west) / 2,
        timestamp: Date.now(),
    });
};

const useMapPosition = (
    liveBeacons: Beacon[],
    { beacon, ts }: FocusedBeaconState,
): {
    bounds?: Bounds;
    centerGeoUri?: string;
} => {
    const [bounds, setBounds] = useState<Bounds | undefined>(getBeaconBounds(liveBeacons));
    const [centerGeoUri, setCenterGeoUri] = useState<string | undefined>(
        beacon?.latestLocationState?.uri || getBoundsCenter(bounds),
    );

    useEffect(() => {
        if (
            // this check ignores the first initial focused beacon state
            // as centering logic on map zooms to show everything
            // instead of focusing down
            ts !== 0 &&
            // only set focus to a known location
            beacon?.latestLocationState?.uri
        ) {
            // append custom `mxTs` parameter to geoUri
            // so map is triggered to refocus on this uri
            // event if it was previously the center geouri
            // but the map have moved/zoomed
            setCenterGeoUri(`${beacon?.latestLocationState?.uri};mxTs=${Date.now()}`);
            setBounds(getBeaconBounds([beacon]));
        }
    }, [beacon, ts]);

    return { bounds, centerGeoUri };
};

/**
 * Dialog to view live beacons maximised
 */
const BeaconViewDialog: React.FC<IProps> = ({ initialFocusedBeacon, roomId, matrixClient, onFinished }) => {
    const liveBeacons = useLiveBeacons(roomId, matrixClient);
    const [focusedBeaconState, setFocusedBeaconState] = useState<FocusedBeaconState>({
        beacon: initialFocusedBeacon,
        ts: 0,
    });

    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const { bounds, centerGeoUri } = useMapPosition(liveBeacons, focusedBeaconState);

    const [mapDisplayError, setMapDisplayError] = useState<unknown>();

    // automatically open the sidebar if there is no map to see
    useEffect(() => {
        if (mapDisplayError) {
            setSidebarOpen(true);
        }
    }, [mapDisplayError]);

    const onBeaconListItemClick = (beacon: Beacon): void => {
        setFocusedBeaconState({ beacon, ts: Date.now() });
    };

    const hasOwnBeacon =
        liveBeacons.filter((beacon) => beacon?.beaconInfoOwner === matrixClient.getUserId()).length > 0;

    return (
        <BaseDialog className="mx_BeaconViewDialog" onFinished={onFinished} fixedWidth={false}>
            <MatrixClientContext.Provider value={matrixClient}>
                {centerGeoUri && !mapDisplayError && (
                    <Map
                        id="mx_BeaconViewDialog"
                        bounds={bounds}
                        centerGeoUri={centerGeoUri}
                        interactive
                        onError={setMapDisplayError}
                        className="mx_BeaconViewDialog_map"
                        allowGeolocate={!hasOwnBeacon}
                    >
                        {({ map }: { map: maplibregl.Map }) => (
                            <>
                                {liveBeacons.map((beacon) => (
                                    <BeaconMarker
                                        key={beacon.identifier}
                                        map={map}
                                        beacon={beacon}
                                        tooltip={<BeaconStatusTooltip beacon={beacon} />}
                                    />
                                ))}
                                <ZoomButtons map={map} />
                            </>
                        )}
                    </Map>
                )}
                {mapDisplayError instanceof Error && (
                    <MapError error={mapDisplayError.message as LocationShareError} isMinimised />
                )}
                {!centerGeoUri && !mapDisplayError && (
                    <MapFallback data-testid="beacon-view-dialog-map-fallback" className="mx_BeaconViewDialog_map">
                        <span className="mx_BeaconViewDialog_mapFallbackMessage">
                            {_t("location_sharing|live_locations_empty")}
                        </span>
                        <AccessibleButton
                            kind="primary"
                            onClick={onFinished}
                            data-testid="beacon-view-dialog-fallback-close"
                        >
                            {_t("action|close")}
                        </AccessibleButton>
                    </MapFallback>
                )}
                {isSidebarOpen ? (
                    <DialogSidebar
                        beacons={liveBeacons}
                        onBeaconClick={onBeaconListItemClick}
                        requestClose={() => setSidebarOpen(false)}
                    />
                ) : (
                    <AccessibleButton
                        kind="primary"
                        onClick={() => setSidebarOpen(true)}
                        data-testid="beacon-view-dialog-open-sidebar"
                        className="mx_BeaconViewDialog_viewListButton"
                    >
                        <LiveLocationIcon height={12} />
                        &nbsp;
                        {_t("action|view_list")}
                    </AccessibleButton>
                )}
                <DialogOwnBeaconStatus roomId={roomId} />
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default BeaconViewDialog;
