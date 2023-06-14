/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { useState, useEffect } from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Beacon, Room } from "matrix-js-sdk/src/matrix";
import * as maplibregl from "maplibre-gl";

import { Icon as LiveLocationIcon } from "../../../../res/img/location/live-location.svg";
import { useLiveBeacons } from "../../../utils/beacon/useLiveBeacons";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BaseDialog from "../dialogs/BaseDialog";
import Map from "../location/Map";
import ZoomButtons from "../location/ZoomButtons";
import BeaconMarker from "./BeaconMarker";
import { Bounds, getBeaconBounds } from "../../../utils/beacon/bounds";
import { getGeoUri } from "../../../utils/beacon";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import DialogSidebar from "./DialogSidebar";
import DialogOwnBeaconStatus from "./DialogOwnBeaconStatus";
import BeaconStatusTooltip from "./BeaconStatusTooltip";
import MapFallback from "../location/MapFallback";
import { MapError } from "../location/MapError";
import { LocationShareError } from "../../../utils/location";

interface IProps {
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

    const [mapDisplayError, setMapDisplayError] = useState<Error>();

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
                {mapDisplayError && <MapError error={mapDisplayError.message as LocationShareError} isMinimised />}
                {!centerGeoUri && !mapDisplayError && (
                    <MapFallback data-testid="beacon-view-dialog-map-fallback" className="mx_BeaconViewDialog_map">
                        <span className="mx_BeaconViewDialog_mapFallbackMessage">{_t("No live locations")}</span>
                        <AccessibleButton
                            kind="primary"
                            onClick={onFinished}
                            data-testid="beacon-view-dialog-fallback-close"
                        >
                            {_t("Close")}
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
                        {_t("View list")}
                    </AccessibleButton>
                )}
                <DialogOwnBeaconStatus roomId={roomId} />
            </MatrixClientContext.Provider>
        </BaseDialog>
    );
};

export default BeaconViewDialog;
