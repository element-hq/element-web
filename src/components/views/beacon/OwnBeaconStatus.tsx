/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Beacon } from "matrix-js-sdk/src/matrix";
import React, { type HTMLProps } from "react";

import { _t } from "../../../languageHandler";
import { useOwnLiveBeacons } from "../../../utils/beacon";
import { preventDefaultWrapper } from "../../../utils/NativeEventUtils";
import BeaconStatus from "./BeaconStatus";
import { BeaconDisplayStatus } from "./displayStatus";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

interface Props {
    displayStatus: BeaconDisplayStatus;
    className?: string;
    beacon?: Beacon;
    withIcon?: boolean;
}

/**
 * Wraps BeaconStatus with more capabilities
 * for errors and actions available for users own live beacons
 */
const OwnBeaconStatus: React.FC<Props & HTMLProps<HTMLDivElement>> = ({ beacon, displayStatus, ...rest }) => {
    const {
        hasLocationPublishError,
        hasStopSharingError,
        stoppingInProgress,
        onStopSharing,
        onResetLocationPublishError,
    } = useOwnLiveBeacons(beacon?.identifier ? [beacon?.identifier] : []);

    // combine display status with errors that only occur for user's own beacons
    const ownDisplayStatus = hasLocationPublishError || hasStopSharingError ? BeaconDisplayStatus.Error : displayStatus;

    return (
        <BeaconStatus
            beacon={beacon}
            displayStatus={ownDisplayStatus}
            label={_t("location_sharing|live_location_enabled")}
            displayLiveTimeRemaining
            {...rest}
        >
            {ownDisplayStatus === BeaconDisplayStatus.Active && (
                <AccessibleButton
                    data-testid="beacon-status-stop-beacon"
                    kind="link"
                    // eat events here to avoid 1) the map and 2) reply or thread tiles
                    // moving under the beacon status on stop/retry click
                    onClick={preventDefaultWrapper<ButtonEvent>(onStopSharing)}
                    className="mx_OwnBeaconStatus_button mx_OwnBeaconStatus_destructiveButton"
                    disabled={stoppingInProgress}
                >
                    {_t("action|stop")}
                </AccessibleButton>
            )}
            {hasLocationPublishError && (
                <AccessibleButton
                    data-testid="beacon-status-reset-wire-error"
                    kind="link"
                    // eat events here to avoid 1) the map and 2) reply or thread tiles
                    // moving under the beacon status on stop/retry click
                    onClick={preventDefaultWrapper(onResetLocationPublishError)}
                    className="mx_OwnBeaconStatus_button mx_OwnBeaconStatus_destructiveButton"
                >
                    {_t("action|retry")}
                </AccessibleButton>
            )}
            {hasStopSharingError && (
                <AccessibleButton
                    data-testid="beacon-status-stop-beacon-retry"
                    kind="link"
                    // eat events here to avoid 1) the map and 2) reply or thread tiles
                    // moving under the beacon status on stop/retry click
                    onClick={preventDefaultWrapper(onStopSharing)}
                    className="mx_OwnBeaconStatus_button mx_OwnBeaconStatus_destructiveButton"
                >
                    {_t("action|retry")}
                </AccessibleButton>
            )}
        </BeaconStatus>
    );
};

export default OwnBeaconStatus;
