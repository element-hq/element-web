/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLProps } from "react";
import classNames from "classnames";
import { type Beacon } from "matrix-js-sdk/src/matrix";

import StyledLiveBeaconIcon from "./StyledLiveBeaconIcon";
import { _t } from "../../../languageHandler";
import LiveTimeRemaining from "./LiveTimeRemaining";
import { BeaconDisplayStatus } from "./displayStatus";
import { getBeaconExpiryTimestamp } from "../../../utils/beacon";
import { formatTime } from "../../../DateUtils";

interface Props {
    displayStatus: BeaconDisplayStatus;
    displayLiveTimeRemaining?: boolean;
    withIcon?: boolean;
    beacon?: Beacon;
    label?: string;
}

const BeaconExpiryTime: React.FC<{ beacon: Beacon }> = ({ beacon }) => {
    const expiryTime = formatTime(new Date(getBeaconExpiryTimestamp(beacon)));
    return <span className="mx_BeaconStatus_expiryTime">{_t("location_sharing|live_until", { expiryTime })}</span>;
};

const BeaconStatus: React.FC<Props & HTMLProps<HTMLDivElement>> = ({
    beacon,
    displayStatus,
    displayLiveTimeRemaining,
    label,
    className,
    children,
    withIcon,
    ...rest
}) => {
    const isIdle = displayStatus === BeaconDisplayStatus.Loading || displayStatus === BeaconDisplayStatus.Stopped;

    return (
        <div {...rest} className={classNames("mx_BeaconStatus", `mx_BeaconStatus_${displayStatus}`, className)}>
            {withIcon && (
                <StyledLiveBeaconIcon
                    className="mx_BeaconStatus_icon"
                    withError={displayStatus === BeaconDisplayStatus.Error}
                    isIdle={isIdle}
                />
            )}
            <div className="mx_BeaconStatus_description">
                {displayStatus === BeaconDisplayStatus.Loading && (
                    <span className="mx_BeaconStatus_description_status">
                        {_t("location_sharing|loading_live_location")}
                    </span>
                )}
                {displayStatus === BeaconDisplayStatus.Stopped && (
                    <span className="mx_BeaconStatus_description_status">
                        {_t("location_sharing|live_location_ended")}
                    </span>
                )}
                {displayStatus === BeaconDisplayStatus.Error && (
                    <span className="mx_BeaconStatus_description_status">
                        {_t("location_sharing|live_location_error")}
                    </span>
                )}
                {displayStatus === BeaconDisplayStatus.Active && beacon && (
                    <>
                        <>
                            <span className="mx_BeaconStatus_label">{label}</span>
                            {displayLiveTimeRemaining ? (
                                <LiveTimeRemaining beacon={beacon} />
                            ) : (
                                <BeaconExpiryTime beacon={beacon} />
                            )}
                        </>
                    </>
                )}
            </div>
            {children}
        </div>
    );
};

export default BeaconStatus;
