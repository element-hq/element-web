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

import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../../stores/OwnBeaconStore";
import { useOwnLiveBeacons } from "../../../utils/beacon";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import Spinner from "../elements/Spinner";
import StyledLiveBeaconIcon from "./StyledLiveBeaconIcon";
import { Icon as CloseIcon } from "../../../../res/img/image-view/close.svg";
import LiveTimeRemaining from "./LiveTimeRemaining";
import dispatcher from "../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";

const getLabel = (hasLocationPublishError: boolean, hasStopSharingError: boolean): string => {
    if (hasLocationPublishError) {
        return _t("An error occurred whilst sharing your live location, please try again");
    }
    if (hasStopSharingError) {
        return _t("An error occurred while stopping your live location, please try again");
    }
    return _t("You are sharing your live location");
};

interface RoomLiveShareWarningInnerProps {
    liveBeaconIds: string[];
    roomId: Room["roomId"];
}
const RoomLiveShareWarningInner: React.FC<RoomLiveShareWarningInnerProps> = ({ liveBeaconIds, roomId }) => {
    const {
        onStopSharing,
        onResetLocationPublishError,
        beacon,
        stoppingInProgress,
        hasStopSharingError,
        hasLocationPublishError,
    } = useOwnLiveBeacons(liveBeaconIds);

    if (!beacon) {
        return null;
    }

    const hasError = hasStopSharingError || hasLocationPublishError;

    // eat events from buttons so navigate to tile
    // is not triggered
    const stopPropagationWrapper =
        (callback: () => void) =>
        (e?: ButtonEvent): void => {
            e?.stopPropagation();
            callback();
        };

    const onButtonClick = (): void => {
        if (hasLocationPublishError) {
            onResetLocationPublishError();
        } else {
            onStopSharing();
        }
    };

    const onClick = (): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: beacon.roomId,
            metricsTrigger: undefined,
            event_id: beacon.beaconInfoId,
            scroll_into_view: true,
            highlighted: true,
        });
    };

    return (
        <div className="mx_RoomLiveShareWarning" onClick={onClick}>
            <StyledLiveBeaconIcon className="mx_RoomLiveShareWarning_icon" withError={hasError} />

            <span className="mx_RoomLiveShareWarning_label">
                {getLabel(hasLocationPublishError, hasStopSharingError)}
            </span>

            {stoppingInProgress && (
                <span className="mx_RoomLiveShareWarning_spinner">
                    <Spinner h={16} w={16} />
                </span>
            )}
            {!stoppingInProgress && !hasError && <LiveTimeRemaining beacon={beacon} />}

            <AccessibleButton
                className="mx_RoomLiveShareWarning_stopButton"
                data-testid="room-live-share-primary-button"
                onClick={stopPropagationWrapper(onButtonClick)}
                kind="danger"
                element="button"
                disabled={stoppingInProgress}
            >
                {hasError ? _t("Retry") : _t("Stop")}
            </AccessibleButton>
            {hasLocationPublishError && (
                <AccessibleButton
                    data-testid="room-live-share-wire-error-close-button"
                    title={_t("Stop and close")}
                    element="button"
                    className="mx_RoomLiveShareWarning_closeButton"
                    onClick={stopPropagationWrapper(onStopSharing)}
                >
                    <CloseIcon className="mx_RoomLiveShareWarning_closeButtonIcon" />
                </AccessibleButton>
            )}
        </div>
    );
};

interface Props {
    roomId: Room["roomId"];
}
const RoomLiveShareWarning: React.FC<Props> = ({ roomId }) => {
    // do we have an active geolocation.watchPosition
    const isMonitoringLiveLocation = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.MonitoringLivePosition,
        () => OwnBeaconStore.instance.isMonitoringLiveLocation,
    );

    const liveBeaconIds = useEventEmitterState(OwnBeaconStore.instance, OwnBeaconStoreEvent.LivenessChange, () =>
        OwnBeaconStore.instance.getLiveBeaconIds(roomId),
    );

    if (!isMonitoringLiveLocation || !liveBeaconIds.length) {
        // This logic is entangled with the RoomCallBanner-test's. The tests need updating if this logic changes.
        return null;
    }

    // split into outer/inner to avoid watching various parts of live beacon state
    // when there are none
    return <RoomLiveShareWarningInner liveBeaconIds={liveBeaconIds} roomId={roomId} />;
};

export default RoomLiveShareWarning;
