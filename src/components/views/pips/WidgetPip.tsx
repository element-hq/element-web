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

import React, { FC, MutableRefObject, useCallback, useMemo } from "react";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";

import PersistentApp from "../elements/PersistentApp";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { useCallForWidget } from "../../../hooks/useCall";
import WidgetStore from "../../../stores/WidgetStore";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import Toolbar from "../../../accessibility/Toolbar";
import { RovingAccessibleButton, RovingAccessibleTooltipButton } from "../../../accessibility/RovingTabIndex";
import { Icon as BackIcon } from "../../../../res/img/element-icons/back.svg";
import { Icon as HangupIcon } from "../../../../res/img/element-icons/call/hangup.svg";
import { _t } from "../../../languageHandler";
import { WidgetType } from "../../../widgets/WidgetType";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import WidgetUtils from "../../../utils/WidgetUtils";
import { ElementWidgetActions } from "../../../stores/widgets/ElementWidgetActions";
import { Alignment } from "../elements/Tooltip";

interface Props {
    widgetId: string;
    room: Room;
    viewingRoom: boolean;
    onStartMoving: (e: React.MouseEvent<Element, MouseEvent>) => void;
    movePersistedElement: MutableRefObject<(() => void) | undefined>;
}

/**
 * A picture-in-picture view for a widget. Additional controls are shown if the
 * widget is a call of some sort.
 */
export const WidgetPip: FC<Props> = ({ widgetId, room, viewingRoom, onStartMoving, movePersistedElement }) => {
    const widget = useMemo(
        () => WidgetStore.instance.getApps(room.roomId).find((app) => app.id === widgetId)!,
        [room, widgetId],
    );

    const roomName = useTypedEventEmitterState(
        room,
        RoomEvent.Name,
        useCallback(() => room.name, [room]),
    );

    const call = useCallForWidget(widgetId, room.roomId);

    const onBackClick = useCallback(
        (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            if (call !== null) {
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    view_call: true,
                    metricsTrigger: "WebFloatingCallWindow",
                });
            } else if (viewingRoom) {
                WidgetLayoutStore.instance.moveToContainer(room, widget, Container.Center);
            } else {
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    metricsTrigger: "WebFloatingCallWindow",
                });
            }
        },
        [room, call, widget, viewingRoom],
    );

    const onLeaveClick = useCallback(
        (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            if (call !== null) {
                call.disconnect().catch((e) => console.error("Failed to leave call", e));
            } else {
                // Assumed to be a Jitsi widget
                WidgetMessagingStore.instance
                    .getMessagingForUid(WidgetUtils.getWidgetUid(widget))
                    ?.transport.send(ElementWidgetActions.HangupCall, {})
                    .catch((e) => console.error("Failed to leave Jitsi", e));
            }
        },
        [call, widget],
    );

    return (
        <div className="mx_WidgetPip" onMouseDown={onStartMoving} onClick={onBackClick}>
            <Toolbar className="mx_WidgetPip_header">
                <RovingAccessibleButton
                    onClick={onBackClick}
                    className="mx_WidgetPip_backButton"
                    aria-label={_t("Back")}
                >
                    <BackIcon className="mx_Icon mx_Icon_16" />
                    {roomName}
                </RovingAccessibleButton>
            </Toolbar>
            <PersistentApp
                persistentWidgetId={widgetId}
                persistentRoomId={room.roomId}
                pointerEvents="none"
                movePersistedElement={movePersistedElement}
            />
            {(call !== null || WidgetType.JITSI.matches(widget?.type)) && (
                <Toolbar className="mx_WidgetPip_footer">
                    <RovingAccessibleTooltipButton
                        onClick={onLeaveClick}
                        tooltip={_t("Leave")}
                        aria-label={_t("Leave")}
                        alignment={Alignment.Top}
                    >
                        <HangupIcon className="mx_Icon mx_Icon_24" />
                    </RovingAccessibleTooltipButton>
                </Toolbar>
            )}
        </div>
    );
};
