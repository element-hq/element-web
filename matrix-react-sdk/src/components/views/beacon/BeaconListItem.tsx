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

import React, { HTMLProps, useContext } from "react";
import { Beacon, BeaconEvent } from "matrix-js-sdk/src/matrix";
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { humanizeTime } from "../../../utils/humanize";
import { preventDefaultWrapper } from "../../../utils/NativeEventUtils";
import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import BeaconStatus from "./BeaconStatus";
import { BeaconDisplayStatus } from "./displayStatus";
import StyledLiveBeaconIcon from "./StyledLiveBeaconIcon";
import ShareLatestLocation from "./ShareLatestLocation";

interface Props {
    beacon: Beacon;
}

const BeaconListItem: React.FC<Props & HTMLProps<HTMLLIElement>> = ({ beacon, ...rest }) => {
    const latestLocationState = useEventEmitterState(
        beacon,
        BeaconEvent.LocationUpdate,
        () => beacon.latestLocationState,
    );
    const matrixClient = useContext(MatrixClientContext);
    const room = matrixClient.getRoom(beacon.roomId);

    if (!latestLocationState || !beacon.isLive || !room) {
        return null;
    }

    const isSelfLocation = beacon.beaconInfo?.assetType === LocationAssetType.Self;
    const beaconMember = isSelfLocation ? room.getMember(beacon.beaconInfoOwner) : null;

    const humanizedUpdateTime = (latestLocationState.timestamp && humanizeTime(latestLocationState.timestamp)) || "";

    return (
        <li className="mx_BeaconListItem" {...rest}>
            {isSelfLocation ? (
                <MemberAvatar className="mx_BeaconListItem_avatar" member={beaconMember} height={32} width={32} />
            ) : (
                <StyledLiveBeaconIcon className="mx_BeaconListItem_avatarIcon" />
            )}
            <div className="mx_BeaconListItem_info">
                <BeaconStatus
                    className="mx_BeaconListItem_status"
                    beacon={beacon}
                    label={beaconMember?.name || beacon.beaconInfo?.description || beacon.beaconInfoOwner}
                    displayStatus={BeaconDisplayStatus.Active}
                >
                    {/* eat events from interactive share buttons
                so parent click handlers are not triggered */}
                    <div className="mx_BeaconListItem_interactions" onClick={preventDefaultWrapper(() => {})}>
                        <ShareLatestLocation latestLocationState={latestLocationState} />
                    </div>
                </BeaconStatus>
                <span className="mx_BeaconListItem_lastUpdated">
                    {_t("Updated %(humanizedUpdateTime)s", { humanizedUpdateTime })}
                </span>
            </div>
        </li>
    );
};

export default BeaconListItem;
