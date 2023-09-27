/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/matrix";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { useFeatureEnabled } from "../useSettings";
import SdkConfig from "../../SdkConfig";
import { useEventEmitter, useEventEmitterState } from "../useEventEmitter";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { useWidgets } from "../../components/views/right_panel/RoomSummaryCard";
import { WidgetType } from "../../widgets/WidgetType";
import { useCall } from "../useCall";
import { useRoomMemberCount } from "../useRoomMembers";
import { ElementCall } from "../../models/Call";
import { placeCall } from "../../utils/room/placeCall";
import { Container, WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { useRoomState } from "../useRoomState";
import { _t } from "../../languageHandler";
import { isManagedHybridWidget } from "../../widgets/ManagedHybrid";
import { IApp } from "../../stores/WidgetStore";

export type PlatformCallType = "element_call" | "jitsi_or_element_call" | "legacy_or_jitsi";

const enum State {
    NoCall,
    NoOneHere,
    NoPermission,
    Unpinned,
    Ongoing,
}

/**
 * Utility hook for resolving state and click handlers for Voice & Video call buttons in the room header
 * @param room the room to track
 * @returns the call button attributes for the given room
 */
export const useRoomCall = (
    room: Room,
): {
    voiceCallDisabledReason: string | null;
    voiceCallClick(evt: React.MouseEvent): void;
    videoCallDisabledReason: string | null;
    videoCallClick(evt: React.MouseEvent): void;
} => {
    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively;
    }, []);

    const hasLegacyCall = useEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.CallsChanged,
        () => LegacyCallHandler.instance.getCallForRoom(room.roomId) !== null,
    );

    const widgets = useWidgets(room);
    const jitsiWidget = useMemo(() => widgets.find((widget) => WidgetType.JITSI.matches(widget.type)), [widgets]);
    const hasJitsiWidget = !!jitsiWidget;
    const managedHybridWidget = useMemo(() => widgets.find(isManagedHybridWidget), [widgets]);
    const hasManagedHybridWidget = !!managedHybridWidget;

    const groupCall = useCall(room.roomId);
    const hasGroupCall = groupCall !== null;

    const memberCount = useRoomMemberCount(room);

    const [mayEditWidgets, mayCreateElementCalls] = useRoomState(room, () => [
        room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
        room.currentState.mayClientSendStateEvent(ElementCall.CALL_EVENT_TYPE.name, room.client),
    ]);

    const callType = useMemo((): PlatformCallType => {
        if (groupCallsEnabled) {
            if (hasGroupCall) {
                return "jitsi_or_element_call";
            }
            if (mayCreateElementCalls && hasJitsiWidget) {
                return "jitsi_or_element_call";
            }
            if (useElementCallExclusively) {
                return "element_call";
            }
            if (memberCount <= 2) {
                return "legacy_or_jitsi";
            }
            if (mayCreateElementCalls) {
                return "element_call";
            }
        }
        return "legacy_or_jitsi";
    }, [
        groupCallsEnabled,
        hasGroupCall,
        mayCreateElementCalls,
        hasJitsiWidget,
        useElementCallExclusively,
        memberCount,
    ]);

    let widget: IApp | undefined;
    if (callType === "legacy_or_jitsi") {
        widget = jitsiWidget ?? managedHybridWidget;
    } else if (callType === "element_call") {
        widget = groupCall?.widget;
    } else {
        widget = groupCall?.widget ?? jitsiWidget;
    }

    const [canPinWidget, setCanPinWidget] = useState(false);
    const [widgetPinned, setWidgetPinned] = useState(false);
    const promptPinWidget = canPinWidget && !widgetPinned;

    const updateWidgetState = useCallback((): void => {
        setCanPinWidget(WidgetLayoutStore.instance.canAddToContainer(room, Container.Top));
        setWidgetPinned(!!widget && WidgetLayoutStore.instance.isInContainer(room, widget, Container.Top));
    }, [room, widget]);

    useEventEmitter(WidgetLayoutStore.instance, WidgetLayoutStore.emissionForRoom(room), updateWidgetState);
    useEffect(() => {
        updateWidgetState();
    }, [room, jitsiWidget, groupCall, updateWidgetState]);

    const state = useMemo((): State => {
        if (hasGroupCall || hasJitsiWidget || hasManagedHybridWidget) {
            return promptPinWidget ? State.Unpinned : State.Ongoing;
        }
        if (hasLegacyCall) {
            return State.Ongoing;
        }

        if (memberCount <= 1) {
            return State.NoOneHere;
        }

        if (!mayCreateElementCalls && !mayEditWidgets) {
            return State.NoPermission;
        }

        return State.NoCall;
    }, [
        hasGroupCall,
        hasJitsiWidget,
        hasLegacyCall,
        hasManagedHybridWidget,
        mayCreateElementCalls,
        mayEditWidgets,
        memberCount,
        promptPinWidget,
    ]);

    const voiceCallClick = useCallback(
        (evt: React.MouseEvent): void => {
            evt.stopPropagation();
            if (widget && promptPinWidget) {
                WidgetLayoutStore.instance.moveToContainer(room, widget, Container.Top);
            } else {
                placeCall(room, CallType.Voice, callType);
            }
        },
        [promptPinWidget, room, widget, callType],
    );
    const videoCallClick = useCallback(
        (evt: React.MouseEvent): void => {
            evt.stopPropagation();
            if (widget && promptPinWidget) {
                WidgetLayoutStore.instance.moveToContainer(room, widget, Container.Top);
            } else {
                placeCall(room, CallType.Video, callType);
            }
        },
        [widget, promptPinWidget, room, callType],
    );

    let voiceCallDisabledReason: string | null;
    let videoCallDisabledReason: string | null;
    switch (state) {
        case State.NoPermission:
            voiceCallDisabledReason = _t("voip|disabled_no_perms_start_voice_call");
            videoCallDisabledReason = _t("voip|disabled_no_perms_start_video_call");
            break;
        case State.Ongoing:
            voiceCallDisabledReason = _t("voip|disabled_ongoing_call");
            videoCallDisabledReason = _t("voip|disabled_ongoing_call");
            break;
        case State.NoOneHere:
            voiceCallDisabledReason = _t("voip|disabled_no_one_here");
            videoCallDisabledReason = _t("voip|disabled_no_one_here");
            break;
        case State.Unpinned:
        case State.NoCall:
            voiceCallDisabledReason = null;
            videoCallDisabledReason = null;
    }

    /**
     * We've gone through all the steps
     */
    return {
        voiceCallDisabledReason,
        voiceCallClick,
        videoCallDisabledReason,
        videoCallClick,
    };
};
