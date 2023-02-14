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

import React, { HTMLProps } from "react";
import classNames from "classnames";
import { Beacon } from "matrix-js-sdk/src/matrix";

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
    return <span className="mx_BeaconStatus_expiryTime">{_t("Live until %(expiryTime)s", { expiryTime })}</span>;
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
                    <span className="mx_BeaconStatus_description_status">{_t("Loading live location…")}</span>
                )}
                {displayStatus === BeaconDisplayStatus.Stopped && (
                    <span className="mx_BeaconStatus_description_status">{_t("Live location ended")}</span>
                )}
                {displayStatus === BeaconDisplayStatus.Error && (
                    <span className="mx_BeaconStatus_description_status">{_t("Live location error")}</span>
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
