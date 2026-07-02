/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext, useEffect } from "react";
import {
    type MatrixEvent,
    EventType,
    MsgType,
    RelationType,
    type MatrixClient,
    GroupCallIntent,
    M_POLL_END,
    M_POLL_START,
} from "matrix-js-sdk/src/matrix";
import {
    EncryptionEventView,
    HiddenBodyView,
    MJitsiWidgetEventView,
    MKeyVerificationRequestView,
    RoomAvatarEventView,
    RootCallTileView,
    TextualEventView,
    ViewSourceEventView,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import SettingsStore from "../settings/SettingsStore";
import type LegacyCallEventGrouper from "../components/structures/LegacyCallEventGrouper";
import { type IEventTileType, type EventTileProps } from "../components/views/rooms/EventTile";
import { TimelineRenderingType } from "../contexts/RoomContext";
import MessageEvent from "../components/views/messages/MessageEvent";
import LegacyCallEvent from "../components/views/messages/LegacyCallEvent";
import { CallEvent } from "../components/views/messages/CallEvent";
import { RoomPredecessorTile } from "../components/views/messages/RoomPredecessorTile";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import { WIDGET_LAYOUT_EVENT_TYPE } from "../stores/widgets/WidgetLayoutStore";
import { ALL_RULE_TYPES } from "../mjolnir/BanList";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { useMatrixClientContext } from "../contexts/MatrixClientContext";
import { WidgetType } from "../widgets/WidgetType";
import { hasText } from "../TextForEvent";
import { getMessageModerationState, MessageModerationState } from "../utils/EventUtils";
import { shouldDisplayAsBeaconTile } from "../utils/beacon/timeline";
import { type IBodyProps } from "../components/views/messages/IBodyProps";
import { ModuleApi } from "../modules/Api";
import { EncryptionEventViewModel } from "../viewmodels/room/timeline/event-tile/EncryptionEventViewModel";
import { MJitsiWidgetEventViewModel } from "../viewmodels/room/timeline/event-tile/MJitsiWidgetEventViewModel";
import { MKeyVerificationRequestViewModel } from "../viewmodels/room/timeline/event-tile/MKeyVerificationRequestViewModel";
import { RoomAvatarEventViewModel } from "../viewmodels/room/timeline/event-tile/RoomAvatarEventViewModel";
import { TextualEventViewModel } from "../viewmodels/room/timeline/event-tile/TextualEventViewModel";
import { HiddenBodyViewModel } from "../viewmodels/room/timeline/event-tile/body/HiddenBodyViewModel";
import { ViewSourceEventViewModel } from "../viewmodels/room/timeline/event-tile/body/ViewSourceEventViewModel";
import { ElementCallEventType } from "../call-types";
import { RootCallTileViewModel } from "../viewmodels/room/timeline/event-tile/call/RootCallTileViewModel";
import { SDKContext } from "../contexts/SDKContext";

// Subset of EventTile's IProps plus some mixins
export interface EventTileTypeProps extends Pick<
    EventTileProps,
    | "mxEvent"
    | "highlights"
    | "highlightLink"
    | "showUrlPreview"
    | "forExport"
    | "getRelationsForEvent"
    | "editState"
    | "replacingEventId"
    | "permalinkCreator"
    | "callEventGrouper"
    | "isSeeingThroughMessageHiddenForModeration"
    | "inhibitInteraction"
> {
    ref?: React.RefObject<IEventTileType | null>;
    maxImageHeight?: number; // pixels
    overrideBodyTypes?: Record<string, React.ComponentType<IBodyProps>>;
    overrideEventTypes?: Record<string, React.ComponentType<IBodyProps>>;
    showHiddenEvents: boolean;
}

type FactoryProps = Omit<EventTileTypeProps, "ref">;
type Factory<X = FactoryProps> = (ref: React.RefObject<any> | undefined, props: X) => JSX.Element;

export const MessageEventFactory: Factory = (ref, props) => <MessageEvent ref={ref} {...props} />;
const LegacyCallEventFactory: Factory<FactoryProps & { callEventGrouper: LegacyCallEventGrouper }> = (ref, props) => (
    <LegacyCallEvent ref={ref} {...props} />
);
const CallEventFactory: Factory = (ref, props) => <CallEvent ref={ref} {...props} />;
export const TextualEventFactory: Factory = (ref, props) => {
    const vm = new TextualEventViewModel(props);
    return <TextualEventView vm={vm} className="mx_TextualEvent" />;
};
function EncryptionEventWrappedView({ mxEvent, ref }: IBodyProps): JSX.Element {
    const cli = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(() => new EncryptionEventViewModel({ mxEvent, cli }));

    return <EncryptionEventView vm={vm} ref={ref} className="mx_EventTileBubble mx_cryptoEvent" />;
}
const EncryptionEventFactory: Factory = (ref, props) => {
    return <EncryptionEventWrappedView ref={ref} {...props} />;
};
function MKeyVerificationRequestWrappedView({ mxEvent, ref }: IBodyProps): JSX.Element {
    const cli = useMatrixClientContext();
    if (!cli) {
        throw new Error("Attempting to render verification request without a client context!");
    }

    const vm = useCreateAutoDisposedViewModel(() => new MKeyVerificationRequestViewModel({ mxEvent, cli }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    return <MKeyVerificationRequestView vm={vm} ref={ref} className="mx_EventTileBubble mx_cryptoEvent" />;
}
const VerificationReqFactory: Factory = (ref, props) => <MKeyVerificationRequestWrappedView ref={ref} {...props} />;
function HiddenBodyWrappedView({ mxEvent, ref }: IBodyProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new HiddenBodyViewModel({ mxEvent }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    return <HiddenBodyView vm={vm} ref={ref} className="mx_HiddenBody" />;
}
const HiddenEventFactory: Factory = (ref, props) => <HiddenBodyWrappedView ref={ref} {...props} />;

function ViewSourceEventWrappedView({ mxEvent, ref }: IBodyProps): JSX.Element {
    const cli = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(() => new ViewSourceEventViewModel({ mxEvent, cli }));

    useEffect(() => {
        vm.setProps({ cli, mxEvent });
    }, [cli, mxEvent, vm]);

    return (
        <ViewSourceEventView
            vm={vm}
            ref={ref}
            className="mx_ViewSourceEvent mx_EventTile_content"
            expandedClassName="mx_ViewSourceEvent_expanded"
        />
    );
}

function MJitsiWidgetEventWrappedView({ mxEvent, ref }: IBodyProps): JSX.Element {
    const cli = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(() => new MJitsiWidgetEventViewModel({ mxEvent, cli }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    return <MJitsiWidgetEventView vm={vm} ref={ref} className="mx_EventTileBubble" />;
}

function RoomAvatarEventWrappedView({ mxEvent, ref }: IBodyProps): JSX.Element {
    const cli = useMatrixClientContext() ?? MatrixClientPeg.safeGet();
    const vm = useCreateAutoDisposedViewModel(() => new RoomAvatarEventViewModel({ mxEvent, cli }));

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    const roomId = mxEvent.getRoomId();
    const room = roomId ? cli.getRoom(roomId) : null;

    return (
        <RoomAvatarEventView
            vm={vm}
            ref={ref}
            renderAvatar={(snapshot) => (
                <RoomAvatar
                    room={room ?? undefined}
                    size="14px"
                    oobData={{
                        avatarUrl: snapshot.avatarUrl,
                        name: snapshot.roomName,
                    }}
                />
            )}
        />
    );
}
const RoomAvatarEventFactory: Factory = (ref, props) => <RoomAvatarEventWrappedView ref={ref} {...props} />;

function CallStartedTileViewWrapped({ mxEvent, getRelationsForEvent }: IBodyProps): JSX.Element {
    const sdkContext = useContext(SDKContext);
    const cli = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new RootCallTileViewModel({
                mxEvent,
                getRelationsForEvent,
                cli,
                callStore: sdkContext.callStore,
                latestRtcNotificationEventStore: sdkContext.latestRtcNotificationEventStore,
            }),
    );
    return <RootCallTileView vm={vm} />;
}

export const CallStartedEventFactory: Factory = (ref, props) => {
    return <CallStartedTileViewWrapped {...props} />;
};

// These factories are exported for reference comparison against pickFactory()
export const JSONEventFactory: Factory = (ref, props) => <ViewSourceEventWrappedView ref={ref} {...props} />;
export const JitsiEventFactory: Factory = (ref, props) => <MJitsiWidgetEventWrappedView ref={ref} {...props} />;
export const RoomCreateEventFactory: Factory = (_ref, props) => <RoomPredecessorTile {...props} />;

const EVENT_TILE_TYPES = new Map<string, Factory>([
    [EventType.RoomMessage, MessageEventFactory], // note that verification requests are handled in pickFactory()
    [EventType.Sticker, MessageEventFactory],
    [M_POLL_START.name, MessageEventFactory],
    [M_POLL_START.altName, MessageEventFactory],
    [M_POLL_END.name, MessageEventFactory],
    [M_POLL_END.altName, MessageEventFactory],
    [EventType.CallInvite, LegacyCallEventFactory as Factory], // note that this requires a special factory type
    [EventType.RTCNotification, CallStartedEventFactory],
]);

const STATE_EVENT_TILE_TYPES = new Map<string, Factory>([
    [EventType.RoomEncryption, EncryptionEventFactory],
    [EventType.RoomCanonicalAlias, TextualEventFactory],
    [EventType.RoomCreate, RoomCreateEventFactory],
    [EventType.RoomMember, TextualEventFactory],
    [EventType.RoomName, TextualEventFactory],
    [EventType.RoomAvatar, RoomAvatarEventFactory],
    [EventType.RoomThirdPartyInvite, TextualEventFactory],
    [EventType.RoomHistoryVisibility, TextualEventFactory],
    [EventType.RoomTopic, TextualEventFactory],
    [EventType.RoomPowerLevels, TextualEventFactory],
    [EventType.RoomPinnedEvents, TextualEventFactory],
    [EventType.RoomServerAcl, TextualEventFactory],
    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    ["im.vector.modular.widgets", TextualEventFactory], // note that Jitsi widgets are special in pickFactory()
    [WIDGET_LAYOUT_EVENT_TYPE, TextualEventFactory],
    [EventType.RoomTombstone, TextualEventFactory],
    [EventType.RoomJoinRules, TextualEventFactory],
    [EventType.RoomGuestAccess, TextualEventFactory],
]);

for (const evType of ElementCallEventType.names) {
    STATE_EVENT_TILE_TYPES.set(evType, CallEventFactory);
}

// Add all the Mjolnir stuff to the renderer too
for (const evType of ALL_RULE_TYPES) {
    STATE_EVENT_TILE_TYPES.set(evType, TextualEventFactory);
}

// These events should be recorded in the STATE_EVENT_TILE_TYPES
const SINGULAR_STATE_EVENTS = new Set([
    EventType.RoomEncryption,
    EventType.RoomCanonicalAlias,
    EventType.RoomCreate,
    EventType.RoomName,
    EventType.RoomAvatar,
    EventType.RoomHistoryVisibility,
    EventType.RoomTopic,
    EventType.RoomPowerLevels,
    EventType.RoomPinnedEvents,
    EventType.RoomServerAcl,
    WIDGET_LAYOUT_EVENT_TYPE,
    EventType.RoomTombstone,
    EventType.RoomJoinRules,
    EventType.RoomGuestAccess,
]);

/**
 * Find an event tile factory for the given conditions.
 * @param mxEvent The event.
 * @param cli The matrix client to reference when needed.
 * @param showHiddenEvents Whether hidden events should be shown.
 * @param asHiddenEv When true, treat the event as always hidden.
 * @returns The factory, or undefined if not possible.
 */
export function pickFactory(
    mxEvent: MatrixEvent,
    cli: MatrixClient,
    showHiddenEvents: boolean,
    asHiddenEv?: boolean,
): Factory | undefined {
    const evType = mxEvent.getType(); // cache this to reduce call stack execution hits

    // Note: we avoid calling SettingsStore unless absolutely necessary - this code is on the critical path.

    if (asHiddenEv && showHiddenEvents) {
        return JSONEventFactory;
    }

    const noEventFactoryFactory: () => Factory | undefined = () => (showHiddenEvents ? JSONEventFactory : undefined); // just don't render things that we shouldn't render

    // We run all the event type checks first as they might override the factory entirely.

    const moderationState = getMessageModerationState(mxEvent, cli);
    if (moderationState === MessageModerationState.HIDDEN_TO_CURRENT_USER) {
        return HiddenEventFactory;
    }

    if (evType === EventType.RoomMessage) {
        // don't show verification requests we're not involved in,
        // not even when showing hidden events
        const content = mxEvent.getContent();
        if (content?.msgtype === MsgType.KeyVerificationRequest) {
            const me = cli.getUserId();
            if (mxEvent.getSender() !== me && content["to"] !== me) {
                return noEventFactoryFactory(); // not for/from us
            } else {
                // override the factory
                return VerificationReqFactory;
            }
        }
    }

    if (evType === EventType.RoomCreate) {
        const dynamicPredecessorsEnabled = SettingsStore.getValue("feature_dynamic_room_predecessors");
        const predecessor = cli.getRoom(mxEvent.getRoomId())?.findPredecessor(dynamicPredecessorsEnabled);
        if (!predecessor) {
            return noEventFactoryFactory();
        }
    }

    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    if (evType === "im.vector.modular.widgets") {
        let type = mxEvent.getContent()["type"];
        if (!type) {
            // deleted/invalid widget - try the past widget type
            type = mxEvent.getPrevContent()["type"];
        }

        if (WidgetType.JITSI.matches(type)) {
            // override the factory
            return JitsiEventFactory;
        }
    }

    // Try and pick a state event factory, if we can.
    if (mxEvent.isState()) {
        if (shouldDisplayAsBeaconTile(mxEvent)) {
            return MessageEventFactory;
        }

        if (SINGULAR_STATE_EVENTS.has(evType) && mxEvent.getStateKey() !== "") {
            return noEventFactoryFactory(); // improper event type to render
        }

        if (STATE_EVENT_TILE_TYPES.get(evType) === TextualEventFactory && !hasText(mxEvent, cli, showHiddenEvents)) {
            return noEventFactoryFactory();
        }

        return STATE_EVENT_TILE_TYPES.get(evType) ?? noEventFactoryFactory();
    }

    // Blanket override for all events. The MessageEvent component handles redacted states for us.
    if (mxEvent.isRedacted()) {
        return MessageEventFactory;
    }

    if (mxEvent.isRelation(RelationType.Replace)) {
        return noEventFactoryFactory();
    }

    return EVENT_TILE_TYPES.get(evType) ?? noEventFactoryFactory();
}

/**
 * Render an event as a tile
 * @param renderType The render type. Used to inform properties given to the eventual component.
 * @param props The properties to provide to the eventual component.
 * @param cli Optional client instance to use, otherwise the default MatrixClientPeg will be used.
 * @returns The tile as JSX, or null if unable to render.
 */
export function renderTile(
    renderType: TimelineRenderingType,
    props: EventTileTypeProps,
    cli?: MatrixClient,
): JSX.Element | null {
    cli = cli ?? MatrixClientPeg.safeGet(); // because param defaults don't do the correct thing

    const factory = pickFactory(props.mxEvent, cli, props.showHiddenEvents);
    if (!factory) {
        // If we don't have a factory for this event, attempt
        // to find a custom component that can render it.
        // Will return null if no custom component can render it.
        return ModuleApi.instance.customComponents.renderMessage({
            mxEvent: props.mxEvent,
        });
    }

    // Note that we split off the ones we actually care about here just to be sure that we're
    // not going to accidentally send things we shouldn't from lazy callers. Eg: EventTile's
    // lazy calls of `renderTile(..., this.props)` will have a lot more than we actually care
    // about.
    const {
        ref,
        mxEvent,
        forExport,
        replacingEventId,
        editState,
        highlights,
        highlightLink,
        showUrlPreview,
        permalinkCreator,
        callEventGrouper,
        getRelationsForEvent,
        isSeeingThroughMessageHiddenForModeration,
        inhibitInteraction,
        showHiddenEvents,
    } = props;

    switch (renderType) {
        case TimelineRenderingType.File:
        case TimelineRenderingType.Notification:
        case TimelineRenderingType.Thread:
            return ModuleApi.instance.customComponents.renderMessage(
                {
                    mxEvent: props.mxEvent,
                },
                (origProps) =>
                    factory(props.ref, {
                        // We only want a subset of props, so we don't end up causing issues for downstream components.
                        mxEvent,
                        highlights,
                        highlightLink,
                        showUrlPreview: origProps?.showUrlPreview ?? showUrlPreview,
                        editState,
                        replacingEventId,
                        getRelationsForEvent,
                        isSeeingThroughMessageHiddenForModeration,
                        permalinkCreator,
                        inhibitInteraction,
                        showHiddenEvents,
                    }),
            );
        default:
            return ModuleApi.instance.customComponents.renderMessage(
                {
                    mxEvent: props.mxEvent,
                },
                (origProps) =>
                    factory(ref, {
                        // NEARLY ALL THE OPTIONS!
                        mxEvent,
                        forExport,
                        replacingEventId,
                        editState,
                        highlights,
                        highlightLink,
                        showUrlPreview: origProps?.showUrlPreview ?? showUrlPreview,
                        permalinkCreator,
                        callEventGrouper,
                        getRelationsForEvent,
                        isSeeingThroughMessageHiddenForModeration,
                        inhibitInteraction,
                        showHiddenEvents,
                    }),
            );
    }
}

/**
 * A version of renderTile() specifically for replies.
 * @param props The properties to specify on the eventual object.
 * @param showHiddenEvents Whether hidden events should be shown.
 * @param cli Optional client instance to use, otherwise the default MatrixClientPeg will be used.
 * @returns The tile as JSX, or falsy if unable to render.
 */
export function renderReplyTile(
    props: EventTileTypeProps,
    showHiddenEvents: boolean,
    cli?: MatrixClient,
): JSX.Element | null {
    cli = cli ?? MatrixClientPeg.safeGet(); // because param defaults don't do the correct thing

    const factory = pickFactory(props.mxEvent, cli, showHiddenEvents);
    if (!factory) {
        // If we don't have a factory for this event, attempt
        // to find a custom component that can render it.
        // Will return null if no custom component can render it.
        return ModuleApi.instance.customComponents.renderMessage({
            mxEvent: props.mxEvent,
        });
    }

    // See renderTile() for why we split off so much
    const {
        ref,
        mxEvent,
        highlights,
        highlightLink,
        showUrlPreview,
        overrideBodyTypes,
        overrideEventTypes,
        replacingEventId,
        maxImageHeight,
        getRelationsForEvent,
        isSeeingThroughMessageHiddenForModeration,
        permalinkCreator,
    } = props;

    return ModuleApi.instance.customComponents.renderMessage(
        {
            mxEvent: props.mxEvent,
        },
        (origProps) =>
            factory(ref, {
                mxEvent,
                highlights,
                highlightLink,
                showUrlPreview: origProps?.showUrlPreview ?? showUrlPreview,
                overrideBodyTypes,
                overrideEventTypes,
                replacingEventId,
                maxImageHeight,
                getRelationsForEvent,
                isSeeingThroughMessageHiddenForModeration,
                permalinkCreator,
                showHiddenEvents,
            }),
    );
}

// XXX: this'll eventually be dynamic based on the fields once we have extensible event types
const messageTypes = [EventType.RoomMessage, EventType.Sticker];
export function isMessageEvent(ev: MatrixEvent): boolean {
    return (
        messageTypes.includes(ev.getType() as EventType) ||
        M_POLL_START.matches(ev.getType()) ||
        M_POLL_END.matches(ev.getType())
    );
}

export function haveRendererForEvent(
    mxEvent: MatrixEvent,
    matrixClient: MatrixClient,
    showHiddenEvents: boolean,
): boolean {
    // Only show "Message deleted" tile for plain message events, encrypted events,
    // and state events as they'll likely still contain enough keys to be relevant.
    if (mxEvent.isRedacted() && !mxEvent.isEncrypted() && !isMessageEvent(mxEvent) && !mxEvent.isState()) {
        return false;
    }

    // Check to see if we have any hints for this message, which indicates
    // there is a custom renderer for the event.
    if (ModuleApi.instance.customComponents.getHintsForMessage(mxEvent)) {
        return true;
    }

    // No tile for replacement events since they update the original tile
    if (mxEvent.isRelation(RelationType.Replace)) return false;

    const handler = pickFactory(mxEvent, matrixClient, showHiddenEvents);
    if (!handler) return false;
    if (handler === TextualEventFactory) {
        return hasText(mxEvent, matrixClient, showHiddenEvents);
    } else if (handler === STATE_EVENT_TILE_TYPES.get(EventType.RoomCreate)) {
        const dynamicPredecessorsEnabled = SettingsStore.getValue("feature_dynamic_room_predecessors");
        const predecessor = matrixClient.getRoom(mxEvent.getRoomId())?.findPredecessor(dynamicPredecessorsEnabled);
        return Boolean(predecessor);
    } else if (ElementCallEventType.names.some((eventType) => handler === STATE_EVENT_TILE_TYPES.get(eventType))) {
        const intent = mxEvent.getContent()["m.intent"];
        const newlyStarted = Object.keys(mxEvent.getPrevContent()).length === 0;
        // Only interested in events that mark the start of a non-room call
        return newlyStarted && typeof intent === "string" && intent !== GroupCallIntent.Room;
    } else if (handler === JSONEventFactory) {
        return false;
    } else {
        return true;
    }
}
