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

import React, { useContext } from "react";
import { Room, Beacon } from "matrix-js-sdk/src/matrix";
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";

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
                <MemberAvatar
                    className="mx_DialogOwnBeaconStatus_avatar"
                    member={beaconMember}
                    height={32}
                    width={32}
                />
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
