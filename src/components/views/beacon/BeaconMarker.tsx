/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useContext } from "react";
import { type Beacon, BeaconEvent, LocationAssetType } from "matrix-js-sdk/src/matrix";

import type * as maplibregl from "maplibre-gl";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { SmartMarker } from "../location";

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
