/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, type RefObject, useCallback, useMemo } from "react";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import BackIcon from "@vector-im/compound-design-tokens/assets/web/icons/arrow-left";

import PersistentApp from "../elements/PersistentApp";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../../dispatcher/actions";
import { useCallForWidget } from "../../../hooks/useCall";
import WidgetStore from "../../../stores/WidgetStore";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import Toolbar from "../../../accessibility/Toolbar";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import { Icon as HangupIcon } from "../../../../res/img/element-icons/call/hangup.svg";
import { _t } from "../../../languageHandler";
import { WidgetType } from "../../../widgets/WidgetType";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import WidgetUtils from "../../../utils/WidgetUtils";
import { ElementWidgetActions } from "../../../stores/widgets/ElementWidgetActions";
import { type ButtonEvent } from "../elements/AccessibleButton";

interface Props {
    widgetId: string;
    room: Room;
    viewingRoom: boolean;
    onStartMoving: (e: React.MouseEvent<Element, MouseEvent>) => void;
    movePersistedElement: RefObject<(() => void) | null>;
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
        (ev: ButtonEvent) => {
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
        (ev: ButtonEvent) => {
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
            <PersistentApp
                persistentWidgetId={widgetId}
                persistentRoomId={room.roomId}
                pointerEvents="none"
                movePersistedElement={movePersistedElement}
            >
                <div onMouseDown={onStartMoving} className="mx_WidgetPip_overlay">
                    <Toolbar className="mx_WidgetPip_header">
                        <RovingAccessibleButton
                            onClick={onBackClick}
                            className="mx_WidgetPip_backButton"
                            aria-label={_t("action|back")}
                        >
                            <BackIcon className="mx_Icon mx_Icon_16" />
                            {roomName}
                        </RovingAccessibleButton>
                    </Toolbar>
                    {(call !== null || WidgetType.JITSI.matches(widget?.type)) && (
                        <Toolbar className="mx_WidgetPip_footer">
                            <RovingAccessibleButton
                                onClick={onLeaveClick}
                                title={_t("action|leave")}
                                aria-label={_t("action|leave")}
                                placement="top"
                            >
                                <HangupIcon className="mx_Icon mx_Icon_24" />
                            </RovingAccessibleButton>
                        </Toolbar>
                    )}
                </div>
            </PersistentApp>
        </div>
    );
};
