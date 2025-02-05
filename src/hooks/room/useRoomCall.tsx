/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import React, { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import { useFeatureEnabled } from "../useSettings";
import SdkConfig from "../../SdkConfig";
import { useEventEmitter, useEventEmitterState } from "../useEventEmitter";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { useWidgets } from "../../utils/WidgetUtils";
import { WidgetType } from "../../widgets/WidgetType";
import { useCall, useConnectionState, useParticipantCount } from "../useCall";
import { useRoomMemberCount } from "../useRoomMembers";
import { ConnectionState, ElementCall } from "../../models/Call";
import { placeCall } from "../../utils/room/placeCall";
import { Container, WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { useRoomState } from "../useRoomState";
import { _t } from "../../languageHandler";
import { isManagedHybridWidget, isManagedHybridWidgetEnabled } from "../../widgets/ManagedHybrid";
import { type IApp } from "../../stores/WidgetStore";
import { SdkContextClass } from "../../contexts/SDKContext";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../dispatcher/actions";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { isVideoRoom } from "../../utils/video-rooms";
import { useGuestAccessInformation } from "./useGuestAccessInformation";
import SettingsStore from "../../settings/SettingsStore";
import { UIFeature } from "../../settings/UIFeature";
import { BetaPill } from "../../components/views/beta/BetaCard";
import { type InteractionName } from "../../PosthogTrackers";

export enum PlatformCallType {
    ElementCall,
    JitsiCall,
    LegacyCall,
}

export const getPlatformCallTypeProps = (
    platformCallType: PlatformCallType,
): {
    label: string;
    children?: ReactNode;
    analyticsName: InteractionName;
} => {
    switch (platformCallType) {
        case PlatformCallType.ElementCall:
            return {
                label: _t("voip|element_call"),
                analyticsName: "WebVoipOptionElementCall",
                children: <BetaPill />,
            };
        case PlatformCallType.JitsiCall:
            return {
                label: _t("voip|jitsi_call"),
                analyticsName: "WebVoipOptionJitsi",
            };
        case PlatformCallType.LegacyCall:
            return {
                label: _t("voip|legacy_call"),
                analyticsName: "WebVoipOptionLegacy",
            };
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
    isConnectedToCall: boolean;
    hasActiveCallSession: boolean;
    callOptions: PlatformCallType[];
    showVideoCallButton: boolean;
    showVoiceCallButton: boolean;
} => {
    // settings
    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively;
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

    const [mayEditWidgets, mayCreateElementCalls] = useRoomState(room, () => [
        room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
        room.currentState.mayClientSendStateEvent(ElementCall.MEMBER_EVENT_TYPE.name, room.client),
    ]);

    // The options provided to the RoomHeader.
    // If there are multiple options, the user will be prompted to choose.
    const callOptions = useMemo((): PlatformCallType[] => {
        const options: PlatformCallType[] = [];
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
        }
        if (hasGroupCall && WidgetType.CALL.matches(groupCall.widget.type)) {
            // only allow joining the ongoing Element call if there is one.
            return [PlatformCallType.ElementCall];
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
    const [canPinWidget, setCanPinWidget] = useState(false);
    const [widgetPinned, setWidgetPinned] = useState(false);
    // We only want to prompt to pin the widget if it's not element call based.
    const isECWidget = WidgetType.CALL.matches(widget?.type ?? "");
    const promptPinWidget = !isECWidget && canPinWidget && !widgetPinned;
    const connectedCalls = useEventEmitterState(CallStore.instance, CallStoreEvent.ConnectedCalls, () =>
        Array.from(CallStore.instance.connectedCalls),
    );
    const { canInviteGuests } = useGuestAccessInformation(room);

    const state = useMemo((): State => {
        if (connectedCalls.find((call) => call.roomId != room.roomId)) {
            return State.Ongoing;
        }
        if (hasGroupCall && (hasJitsiWidget || hasManagedHybridWidget)) {
            return promptPinWidget ? State.Unpinned : State.Ongoing;
        }
        if (hasLegacyCall) {
            return State.Ongoing;
        }
        if (memberCount <= 1 && !canInviteGuests) {
            return State.NoOneHere;
        }

        if (!mayCreateElementCalls && !mayEditWidgets) {
            return State.NoPermission;
        }
        return State.NoCall;
    }, [
        connectedCalls,
        canInviteGuests,
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

    // We hide the voice call button if it'd have the same effect as the video call button
    let hideVoiceCallButton = isManagedHybridWidgetEnabled(room) || !callOptions.includes(PlatformCallType.LegacyCall);
    let hideVideoCallButton = false;
    // We hide both buttons if they require widgets but widgets are disabled.
    if (memberCount > 2 && !SettingsStore.getValue(UIFeature.Widgets)) {
        hideVoiceCallButton = true;
        hideVideoCallButton = true;
    }

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
        isConnectedToCall: isConnectedToCall,
        hasActiveCallSession: hasActiveCallSession,
        callOptions,
        showVoiceCallButton: !hideVoiceCallButton,
        showVideoCallButton: !hideVideoCallButton,
    };
};
