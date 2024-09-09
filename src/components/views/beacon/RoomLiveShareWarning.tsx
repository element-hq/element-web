/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
        return _t("location_sharing|error_sharing_live_location_try_again");
    }
    if (hasStopSharingError) {
        return _t("location_sharing|error_stopping_live_location_try_again");
    }
    return _t("location_sharing|live_location_active");
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
                {hasError ? _t("action|retry") : _t("action|stop")}
            </AccessibleButton>
            {hasLocationPublishError && (
                <AccessibleButton
                    data-testid="room-live-share-wire-error-close-button"
                    title={_t("location_sharing|stop_and_close")}
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
