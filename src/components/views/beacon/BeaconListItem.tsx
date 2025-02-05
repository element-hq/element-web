/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLProps, useContext } from "react";
import { type Beacon, BeaconEvent, LocationAssetType } from "matrix-js-sdk/src/matrix";

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
                <MemberAvatar className="mx_BeaconListItem_avatar" member={beaconMember} size="32px" />
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
                    {_t("location_sharing|live_update_time", { humanizedUpdateTime })}
                </span>
            </div>
        </li>
    );
};

export default BeaconListItem;
