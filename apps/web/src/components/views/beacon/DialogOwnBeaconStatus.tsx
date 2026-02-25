/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { type Room, type Beacon, LocationAssetType } from "matrix-js-sdk/src/matrix";

import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../../stores/OwnBeaconStore";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import OwnBeaconStatus from "./OwnBeaconStatus";
import { BeaconDisplayStatus } from "./displayStatus";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import MemberAvatar from "../avatars/MemberAvatar";
import StyledLiveBeaconIcon from "./StyledLiveBeaconIcon";

interface Props {
    roomId: Room["roomId"];
}

const useOwnBeacon = (roomId: Room["roomId"]): Beacon | undefined => {
    const ownBeacon = useEventEmitterState(OwnBeaconStore.instance, OwnBeaconStoreEvent.LivenessChange, () => {
        const [ownBeaconId] = OwnBeaconStore.instance.getLiveBeaconIds(roomId);
        return OwnBeaconStore.instance.getBeaconById(ownBeaconId);
    });

    return ownBeacon;
};

const DialogOwnBeaconStatus: React.FC<Props> = ({ roomId }) => {
    const beacon = useOwnBeacon(roomId);

    const matrixClient = useContext(MatrixClientContext);
    const room = matrixClient.getRoom(roomId);

    if (!beacon?.isLive || !room) {
        return null;
    }

    const isSelfLocation = beacon.beaconInfo?.assetType === LocationAssetType.Self;
    const beaconMember = isSelfLocation ? room.getMember(beacon.beaconInfoOwner) : null;

    return (
        <div className="mx_DialogOwnBeaconStatus">
            {isSelfLocation ? (
                <MemberAvatar className="mx_DialogOwnBeaconStatus_avatar" member={beaconMember} size="32px" />
            ) : (
                <StyledLiveBeaconIcon className="mx_DialogOwnBeaconStatus_avatarIcon" />
            )}
            <OwnBeaconStatus
                className="mx_DialogOwnBeaconStatus_status"
                beacon={beacon}
                displayStatus={BeaconDisplayStatus.Active}
            />
        </div>
    );
};

export default DialogOwnBeaconStatus;
