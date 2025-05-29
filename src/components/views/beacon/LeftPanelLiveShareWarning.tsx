/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { useEffect } from "react";
import { type Beacon, type BeaconIdentifier } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";
import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../../stores/OwnBeaconStore";
import { Icon as LiveLocationIcon } from "../../../../res/img/location/live-location.svg";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import dispatcher from "../../../dispatcher/dispatcher";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

interface Props {
    isMinimized?: boolean;
}

/**
 * Choose the most relevant beacon
 */
const chooseBestBeacon = (
    liveBeaconIds: BeaconIdentifier[],
    updateErrorBeaconIds: BeaconIdentifier[],
    locationErrorBeaconIds: BeaconIdentifier[],
): Beacon | undefined => {
    // both lists are ordered by creation timestamp in store
    // so select latest beacon
    const beaconId = updateErrorBeaconIds?.[0] ?? locationErrorBeaconIds?.[0] ?? liveBeaconIds?.[0];
    if (!beaconId) {
        return undefined;
    }
    const beacon = OwnBeaconStore.instance.getBeaconById(beaconId);

    return beacon;
};

const getLabel = (hasStoppingErrors: boolean, hasLocationErrors: boolean): string => {
    if (hasStoppingErrors) {
        return _t("location_sharing|error_stopping_live_location");
    }
    if (hasLocationErrors) {
        return _t("location_sharing|error_sharing_live_location");
    }
    return _t("location_sharing|live_location_active");
};

const useLivenessMonitor = (liveBeaconIds: BeaconIdentifier[], beacons: Map<BeaconIdentifier, Beacon>): void => {
    useEffect(() => {
        // chromium sets the minimum timer interval to 1000ms
        // for inactive tabs
        // refresh beacon monitors when the tab becomes active again
        const onPageVisibilityChanged = (): void => {
            if (document.visibilityState === "visible") {
                liveBeaconIds.forEach((identifier) => beacons.get(identifier)?.monitorLiveness());
            }
        };
        if (liveBeaconIds.length) {
            document.addEventListener("visibilitychange", onPageVisibilityChanged);
        }
        return () => {
            document.removeEventListener("visibilitychange", onPageVisibilityChanged);
        };
    }, [liveBeaconIds, beacons]);
};

const LeftPanelLiveShareWarning: React.FC<Props> = ({ isMinimized }) => {
    const isMonitoringLiveLocation = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.MonitoringLivePosition,
        () => OwnBeaconStore.instance.isMonitoringLiveLocation,
    );

    const beaconIdsWithLocationPublishError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.LocationPublishError,
        () => OwnBeaconStore.instance.getLiveBeaconIdsWithLocationPublishError(),
    );

    const beaconIdsWithStoppingError = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.BeaconUpdateError,
        () =>
            OwnBeaconStore.instance
                .getLiveBeaconIds()
                .filter((beaconId) => OwnBeaconStore.instance.beaconUpdateErrors.has(beaconId)),
    );

    const liveBeaconIds = useEventEmitterState(OwnBeaconStore.instance, OwnBeaconStoreEvent.LivenessChange, () =>
        OwnBeaconStore.instance.getLiveBeaconIds(),
    );

    const hasLocationPublishErrors = !!beaconIdsWithLocationPublishError.length;
    const hasStoppingErrors = !!beaconIdsWithStoppingError.length;

    useLivenessMonitor(liveBeaconIds, OwnBeaconStore.instance.beacons);

    if (!isMonitoringLiveLocation) {
        return null;
    }

    const relevantBeacon = chooseBestBeacon(
        liveBeaconIds,
        beaconIdsWithStoppingError,
        beaconIdsWithLocationPublishError,
    );

    const onWarningClick = relevantBeacon
        ? (_e: ButtonEvent) => {
              dispatcher.dispatch<ViewRoomPayload>({
                  action: Action.ViewRoom,
                  room_id: relevantBeacon.roomId,
                  metricsTrigger: undefined,
                  event_id: relevantBeacon.beaconInfoId,
                  scroll_into_view: true,
                  highlighted: true,
              });
          }
        : null;

    const label = getLabel(hasStoppingErrors, hasLocationPublishErrors);

    return (
        <AccessibleButton
            className={classNames("mx_LeftPanelLiveShareWarning", {
                mx_LeftPanelLiveShareWarning__minimized: isMinimized,
                mx_LeftPanelLiveShareWarning__error: hasLocationPublishErrors || hasStoppingErrors,
            })}
            title={isMinimized ? label : undefined}
            onClick={onWarningClick}
        >
            {isMinimized ? <LiveLocationIcon height={10} /> : label}
        </AccessibleButton>
    );
};

export default LeftPanelLiveShareWarning;
