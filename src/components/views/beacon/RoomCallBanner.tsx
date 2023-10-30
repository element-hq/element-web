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

import React, { useCallback } from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import dispatcher, { defaultDispatcher } from "../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { ConnectionState, ElementCall } from "../../../models/Call";
import { useCall } from "../../../hooks/useCall";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../../stores/OwnBeaconStore";
import { SessionDuration } from "../voip/CallDuration";
import { SdkContextClass } from "../../../contexts/SDKContext";

interface RoomCallBannerProps {
    roomId: Room["roomId"];
    call: ElementCall;
}

const RoomCallBannerInner: React.FC<RoomCallBannerProps> = ({ roomId, call }) => {
    const connect = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: roomId,
                view_call: true,
                metricsTrigger: undefined,
            });
        },
        [roomId],
    );

    // TODO matrix rtc
    const onClick = useCallback(() => {
        logger.log("clicking on the call banner is not supported anymore - there are no timeline events anymore.");
        let messageLikeEventId: string | undefined;
        if (!messageLikeEventId) {
            // Until we have a timeline event for calls this will always be true.
            // We will never jump to the non existing timeline event.
            logger.error("Couldn't find a group call event to jump to");
            return;
        }

        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: undefined,
            event_id: messageLikeEventId,
            scroll_into_view: true,
            highlighted: true,
        });
    }, [roomId]);

    return (
        <div className="mx_RoomCallBanner" onClick={onClick}>
            <div className="mx_RoomCallBanner_text">
                <span className="mx_RoomCallBanner_label">{_t("voip|video_call")}</span>
                <SessionDuration session={call.session} />
            </div>

            <AccessibleButton onClick={connect} kind="primary" element="button" disabled={false}>
                {_t("action|join")}
            </AccessibleButton>
        </div>
    );
};

interface Props {
    roomId: Room["roomId"];
}

const RoomCallBanner: React.FC<Props> = ({ roomId }) => {
    const call = useCall(roomId);

    // this section is to check if we have a live location share. If so, we dont show the call banner
    const isMonitoringLiveLocation = useEventEmitterState(
        OwnBeaconStore.instance,
        OwnBeaconStoreEvent.MonitoringLivePosition,
        () => OwnBeaconStore.instance.isMonitoringLiveLocation,
    );

    const liveBeaconIds = useEventEmitterState(OwnBeaconStore.instance, OwnBeaconStoreEvent.LivenessChange, () =>
        OwnBeaconStore.instance.getLiveBeaconIds(roomId),
    );

    if (isMonitoringLiveLocation && liveBeaconIds.length) {
        return null;
    }

    // Check if the call is already showing. No banner is needed in this case.
    if (SdkContextClass.instance.roomViewStore.isViewingCall()) {
        return null;
    }

    // Split into outer/inner to avoid watching various parts if there is no call
    // No banner if the call is connected (or connecting/disconnecting)
    if (call !== null && call.connectionState === ConnectionState.Disconnected) {
        return <RoomCallBannerInner call={call as ElementCall} roomId={roomId} />;
    }

    return null;
};

export default RoomCallBanner;
