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

import { JoinRule, Room } from "matrix-js-sdk/src/matrix";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";

import { useFeatureEnabled } from "../useSettings";
import SdkConfig from "../../SdkConfig";
import { useEventEmitter, useEventEmitterState } from "../useEventEmitter";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { useWidgets } from "../../components/views/right_panel/RoomSummaryCard";
import { WidgetType } from "../../widgets/WidgetType";
import { useCall, useConnectionState, useParticipantCount } from "../useCall";
import { useRoomMemberCount } from "../useRoomMembers";
import { Call, ConnectionState, ElementCall } from "../../models/Call";
import { placeCall } from "../../utils/room/placeCall";
import { Container, WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { useRoomState } from "../useRoomState";
import { _t } from "../../languageHandler";
import { isManagedHybridWidget } from "../../widgets/ManagedHybrid";
import { IApp } from "../../stores/WidgetStore";
import { SdkContextClass } from "../../contexts/SDKContext";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../dispatcher/actions";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { calculateRoomVia } from "../../utils/permalinks/Permalinks";
import { isVideoRoom } from "../../utils/video-rooms";

export enum PlatformCallType {
    ElementCall,
    JitsiCall,
    LegacyCall,
}
export const getPlatformCallTypeLabel = (platformCallType: PlatformCallType): string => {
    switch (platformCallType) {
        case PlatformCallType.ElementCall:
            return _t("voip|element_call");
        case PlatformCallType.JitsiCall:
            return _t("voip|jitsi_call");
        case PlatformCallType.LegacyCall:
            return _t("voip|legacy_call");
    }
};
const enum State {
    NoCall,
    NoOneHere,
    NoPermission,
    Unpinned,
    Ongoing,
    NotJoined,
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
    voiceCallClick(evt: React.MouseEvent | undefined, selectedType: PlatformCallType): void;
    videoCallDisabledReason: string | null;
    videoCallClick(evt: React.MouseEvent | undefined, selectedType: PlatformCallType): void;
    toggleCallMaximized: () => void;
    isViewingCall: boolean;
    generateCallLink: () => URL;
    canGenerateCallLink: boolean;
    isConnectedToCall: boolean;
    hasActiveCallSession: boolean;
    callOptions: PlatformCallType[];
} => {
    // settings
    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively;
    }, []);

    const guestSpaUrl = useMemo(() => {
        return SdkConfig.get("element_call").guest_spa_url;
    }, []);

    const hasLegacyCall = useEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.CallsChanged,
        () => LegacyCallHandler.instance.getCallForRoom(room.roomId) !== null,
    );
    // settings
    const widgets = useWidgets(room);
    const jitsiWidget = useMemo(() => widgets.find((widget) => WidgetType.JITSI.matches(widget.type)), [widgets]);
    const hasJitsiWidget = !!jitsiWidget;
    const managedHybridWidget = useMemo(() => widgets.find(isManagedHybridWidget), [widgets]);
    const hasManagedHybridWidget = !!managedHybridWidget;

    // group call
    const groupCall = useCall(room.roomId);
    const isConnectedToCall = useConnectionState(groupCall) === ConnectionState.Connected;
    const hasGroupCall = groupCall !== null;
    const hasActiveCallSession = useParticipantCount(groupCall) > 0;
    const isViewingCall = useEventEmitterState(
        SdkContextClass.instance.roomViewStore,
        UPDATE_EVENT,
        () => SdkContextClass.instance.roomViewStore.isViewingCall() || isVideoRoom(room),
    );

    // room
    const memberCount = useRoomMemberCount(room);

    const [mayEditWidgets, mayCreateElementCalls, canJoinWithoutInvite] = useRoomState(room, () => [
        room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
        room.currentState.mayClientSendStateEvent(ElementCall.MEMBER_EVENT_TYPE.name, room.client),
        room.getJoinRule() === "public" || room.getJoinRule() === JoinRule.Knock,
        /*|| room.getJoinRule() === JoinRule.Restricted <- rule for joining via token?*/
    ]);

    // The options provided to the RoomHeader.
    // If there are multiple options, the user will be prompted to choose.
    const callOptions = useMemo((): PlatformCallType[] => {
        const options = [];
        if (memberCount <= 2) {
            options.push(PlatformCallType.LegacyCall);
        } else if (mayEditWidgets || hasJitsiWidget) {
            options.push(PlatformCallType.JitsiCall);
        }
        if (groupCallsEnabled) {
            if (hasGroupCall || mayCreateElementCalls) {
                options.push(PlatformCallType.ElementCall);
            }
            if (useElementCallExclusively && !hasJitsiWidget) {
                return [PlatformCallType.ElementCall];
            }
            if (hasGroupCall && WidgetType.CALL.matches(groupCall.widget.type)) {
                // only allow joining the ongoing Element call if there is one.
                return [PlatformCallType.ElementCall];
            }
        }
        return options;
    }, [
        memberCount,
        mayEditWidgets,
        hasJitsiWidget,
        groupCallsEnabled,
        hasGroupCall,
        mayCreateElementCalls,
        useElementCallExclusively,
        groupCall?.widget.type,
    ]);

    let widget: IApp | undefined;
    if (callOptions.includes(PlatformCallType.JitsiCall) || callOptions.includes(PlatformCallType.LegacyCall)) {
        widget = jitsiWidget ?? managedHybridWidget;
    }
    if (callOptions.includes(PlatformCallType.ElementCall)) {
        widget = groupCall?.widget;
    } else {
        widget = groupCall?.widget ?? jitsiWidget;
    }
    const updateWidgetState = useCallback((): void => {
        setCanPinWidget(WidgetLayoutStore.instance.canAddToContainer(room, Container.Top));
        setWidgetPinned(!!widget && WidgetLayoutStore.instance.isInContainer(room, widget, Container.Top));
    }, [room, widget]);
    useEventEmitter(WidgetLayoutStore.instance, WidgetLayoutStore.emissionForRoom(room), updateWidgetState);
    useEffect(() => {
        updateWidgetState();
    }, [room, jitsiWidget, groupCall, updateWidgetState]);
    const [activeCalls, setActiveCalls] = useState<Call[]>(Array.from(CallStore.instance.activeCalls));
    useEventEmitter(CallStore.instance, CallStoreEvent.ActiveCalls, () => {
        setActiveCalls(Array.from(CallStore.instance.activeCalls));
    });
    const [canPinWidget, setCanPinWidget] = useState(false);
    const [widgetPinned, setWidgetPinned] = useState(false);
    // We only want to prompt to pin the widget if it's not element call based.
    const isECWidget = WidgetType.CALL.matches(widget?.type ?? "");
    const promptPinWidget = !isECWidget && canPinWidget && !widgetPinned;
    const state = useMemo((): State => {
        if (activeCalls.find((call) => call.roomId != room.roomId)) {
            return State.Ongoing;
        }
        if (hasGroupCall && (hasJitsiWidget || hasManagedHybridWidget)) {
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
        activeCalls,
        hasGroupCall,
        hasJitsiWidget,
        hasLegacyCall,
        hasManagedHybridWidget,
        mayCreateElementCalls,
        mayEditWidgets,
        memberCount,
        promptPinWidget,
        room.roomId,
    ]);

    const voiceCallClick = useCallback(
        (evt: React.MouseEvent | undefined, callPlatformType: PlatformCallType): void => {
            evt?.stopPropagation();
            if (widget && promptPinWidget) {
                WidgetLayoutStore.instance.moveToContainer(room, widget, Container.Top);
            } else {
                placeCall(room, CallType.Voice, callPlatformType, evt?.shiftKey ?? false);
            }
        },
        [promptPinWidget, room, widget],
    );
    const videoCallClick = useCallback(
        (evt: React.MouseEvent | undefined, callPlatformType: PlatformCallType): void => {
            evt?.stopPropagation();
            if (widget && promptPinWidget) {
                WidgetLayoutStore.instance.moveToContainer(room, widget, Container.Top);
            } else {
                placeCall(room, CallType.Video, callPlatformType, evt?.shiftKey ?? false);
            }
        },
        [widget, promptPinWidget, room],
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
        case State.NotJoined:
        case State.NoCall:
            voiceCallDisabledReason = null;
            videoCallDisabledReason = null;
    }
    const toggleCallMaximized = useCallback(() => {
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: undefined,
            view_call: !isViewingCall,
        });
    }, [isViewingCall, room.roomId]);

    const generateCallLink = useCallback(() => {
        if (!canJoinWithoutInvite)
            throw new Error("Cannot create link for room that users can not join without invite.");
        if (!guestSpaUrl) throw new Error("No guest SPA url for external links provided.");
        const url = new URL(guestSpaUrl);
        url.pathname = "/room/";
        // Set params for the sharable url
        url.searchParams.set("roomId", room.roomId);
        if (room.hasEncryptionStateEvent()) url.searchParams.set("perParticipantE2EE", "true");
        for (const server of calculateRoomVia(room)) {
            url.searchParams.set("viaServers", server);
        }

        // Move params into hash
        url.hash = "/" + room.name + url.search;
        url.search = "";

        logger.info("Generated element call external url:", url);
        return url;
    }, [canJoinWithoutInvite, guestSpaUrl, room]);
    /**
     * We've gone through all the steps
     */
    return {
        voiceCallDisabledReason,
        voiceCallClick,
        videoCallDisabledReason,
        videoCallClick,
        toggleCallMaximized: toggleCallMaximized,
        isViewingCall: isViewingCall,
        generateCallLink,
        canGenerateCallLink: guestSpaUrl !== undefined && canJoinWithoutInvite,
        isConnectedToCall: isConnectedToCall,
        hasActiveCallSession: hasActiveCallSession,
        callOptions,
    };
};
