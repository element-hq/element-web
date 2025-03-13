/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { type Beacon, LocationAssetType } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BeaconStatus from "./BeaconStatus";
import { BeaconDisplayStatus } from "./displayStatus";
import ShareLatestLocation from "./ShareLatestLocation";

interface Props {
    beacon: Beacon;
}

const useBeaconName = (beacon: Beacon): string | undefined => {
    const matrixClient = useContext(MatrixClientContext);

    if (beacon.beaconInfo?.assetType !== LocationAssetType.Self) {
        return beacon.beaconInfo?.description;
    }
    const room = matrixClient.getRoom(beacon.roomId);
    const member = room?.getMember(beacon.beaconInfoOwner);

    return member?.rawDisplayName || beacon.beaconInfoOwner;
};

const BeaconStatusTooltip: React.FC<Props> = ({ beacon }) => {
    const label = useBeaconName(beacon);

    return (
        <div className="mx_BeaconStatusTooltip">
            <BeaconStatus
                beacon={beacon}
                label={label}
                displayStatus={BeaconDisplayStatus.Active}
                displayLiveTimeRemaining
                className="mx_BeaconStatusTooltip_inner"
            >
                <ShareLatestLocation latestLocationState={beacon.latestLocationState} />
            </BeaconStatus>
        </div>
    );
};

export default BeaconStatusTooltip;
