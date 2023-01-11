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

import React, { ReactNode, useContext } from "react";
import * as maplibregl from "maplibre-gl";
import { Beacon, BeaconEvent } from "matrix-js-sdk/src/matrix";
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import SmartMarker from "../location/SmartMarker";

interface Props {
    map: maplibregl.Map;
    beacon: Beacon;
    tooltip?: ReactNode;
}

/**
 * Updates a map SmartMarker with latest location from given beacon
 */
const BeaconMarker: React.FC<Props> = ({ map, beacon, tooltip }) => {
    const latestLocationState = useEventEmitterState(
        beacon,
        BeaconEvent.LocationUpdate,
        () => beacon.latestLocationState,
    );
    const matrixClient = useContext(MatrixClientContext);
    const room = matrixClient.getRoom(beacon.roomId);

    if (!latestLocationState || !beacon.isLive) {
        return null;
    }

    const geoUri = latestLocationState.uri || "";

    const assetTypeIsSelf = beacon.beaconInfo?.assetType === LocationAssetType.Self;
    const _member = room?.getMember(beacon.beaconInfoOwner);

    const markerRoomMember = assetTypeIsSelf && _member ? _member : undefined;

    return (
        <SmartMarker
            map={map}
            id={beacon.identifier}
            geoUri={geoUri}
            roomMember={markerRoomMember}
            tooltip={tooltip}
            useMemberColor
        />
    );
};

export default BeaconMarker;
