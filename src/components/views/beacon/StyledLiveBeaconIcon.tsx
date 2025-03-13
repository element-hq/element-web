/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import { Icon as LiveLocationIcon } from "../../../../res/img/location/live-location.svg";

interface Props extends React.SVGProps<SVGSVGElement> {
    // use error styling when true
    withError?: boolean;
    isIdle?: boolean;
}
const StyledLiveBeaconIcon: React.FC<Props> = ({ className, withError, isIdle, ...props }) => (
    <LiveLocationIcon
        {...props}
        className={classNames("mx_StyledLiveBeaconIcon", className, {
            mx_StyledLiveBeaconIcon_error: withError,
            mx_StyledLiveBeaconIcon_idle: isIdle,
        })}
    />
);

export default StyledLiveBeaconIcon;
