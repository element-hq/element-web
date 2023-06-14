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

import classNames from "classnames";
import React, { useEffect } from "react";
import { Beacon, BeaconIdentifier } from "matrix-js-sdk/src/matrix";

import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";
import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../../stores/OwnBeaconStore";
import { Icon as LiveLocationIcon } from "../../../../res/img/location/live-location.svg";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import dispatcher from "../../../dispatcher/dispatcher";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";

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
        return _t("An error occurred while stopping your live location");
    }
    if (hasLocationErrors) {
        return _t("An error occurred whilst sharing your live location");
    }
    return _t("You are sharing your live location");
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
