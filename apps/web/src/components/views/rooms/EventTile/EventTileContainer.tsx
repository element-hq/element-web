/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, type JSX, type MouseEvent, type ReactNode } from "react";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import RoomContext, { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import type { EventTileProps } from "../EventTile";
import { EventTileViewModel } from "../../../../viewmodels/room/EventTileViewModel";
import { EventTileComposer } from "./EventTileComposer";
import { EventTileDecryptionFailureBody } from "./EventTileDecryptionFailureBody";
import { Action } from "../../../../dispatcher/actions";
import dis from "../../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { type ShowThreadPayload } from "../../../../dispatcher/payloads/ShowThreadPayload";
import PosthogTrackers from "../../../../PosthogTrackers";
import RedactedBody from "../../messages/RedactedBody";
import { EventPreview } from "../EventPreview";
import { renderTile } from "../../../../events/EventTileFactory";
import { copyPlaintext } from "../../../../utils/strings";

export function EventTileContainer(props: EventTileProps): JSX.Element {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const isRoomEncrypted = Boolean(roomContext.isRoomEncrypted);
    const { ref: _ref, ...renderTileProps } = props;

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new EventTileViewModel({
                cli,
                mxEvent: props.mxEvent,
                forExport: props.forExport,
                showReactions: props.showReactions,
                getRelationsForEvent: props.getRelationsForEvent,
                readReceipts: props.readReceipts?.map(({ userId, ts }) => ({ userId, ts })),
                lastSuccessful: props.lastSuccessful,
                eventSendStatus: props.eventSendStatus,
                timelineRenderingType: roomContext.timelineRenderingType,
                isRedacted: props.isRedacted,
                continuation: props.continuation,
                last: props.last,
                lastInSection: props.lastInSection,
                contextual: props.contextual,
                isSelectedEvent: props.isSelectedEvent,
                isTwelveHour: props.isTwelveHour,
                layout: props.layout,
                editState: props.editState,
                permalinkCreator: props.permalinkCreator,
                alwaysShowTimestamps: props.alwaysShowTimestamps,
                hideSender: props.hideSender,
                hideTimestamp: props.hideTimestamp,
                inhibitInteraction: props.inhibitInteraction,
                showReadReceipts: props.showReadReceipts,
                highlightLink: props.highlightLink,
                isRoomEncrypted,
                callEventGrouper: props.callEventGrouper,
                showHiddenEvents: roomContext.showHiddenEvents,
            }),
    );

    useEffect(() => {
        vm.updateProps({
            cli,
            mxEvent: props.mxEvent,
            forExport: props.forExport,
            showReactions: props.showReactions,
            getRelationsForEvent: props.getRelationsForEvent,
            readReceipts: props.readReceipts?.map(({ userId, ts }) => ({ userId, ts })),
            lastSuccessful: props.lastSuccessful,
            eventSendStatus: props.eventSendStatus,
            timelineRenderingType: roomContext.timelineRenderingType,
            isRedacted: props.isRedacted,
            continuation: props.continuation,
            last: props.last,
            lastInSection: props.lastInSection,
            contextual: props.contextual,
            isSelectedEvent: props.isSelectedEvent,
            isTwelveHour: props.isTwelveHour,
            layout: props.layout,
            editState: props.editState,
            permalinkCreator: props.permalinkCreator,
            alwaysShowTimestamps: props.alwaysShowTimestamps,
            hideSender: props.hideSender,
            hideTimestamp: props.hideTimestamp,
            inhibitInteraction: props.inhibitInteraction,
            showReadReceipts: props.showReadReceipts,
            highlightLink: props.highlightLink,
            isRoomEncrypted,
            callEventGrouper: props.callEventGrouper,
            showHiddenEvents: roomContext.showHiddenEvents,
        });
    }, [
        cli,
        props.mxEvent,
        props.forExport,
        props.showReactions,
        props.getRelationsForEvent,
        props.readReceipts,
        props.lastSuccessful,
        props.eventSendStatus,
        props.isRedacted,
        props.continuation,
        props.last,
        props.lastInSection,
        props.contextual,
        props.isSelectedEvent,
        props.isTwelveHour,
        props.layout,
        props.editState,
        props.permalinkCreator,
        props.alwaysShowTimestamps,
        props.hideSender,
        props.hideTimestamp,
        props.inhibitInteraction,
        props.showReadReceipts,
        props.highlightLink,
        isRoomEncrypted,
        props.callEventGrouper,
        roomContext.showHiddenEvents,
        roomContext.timelineRenderingType,
        vm,
    ]);

    const vmSnapshot = useViewModel(vm);

    const onPermalinkClicked = (ev: MouseEvent<HTMLElement>): void => {
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: vmSnapshot.viewRoomMetricsTrigger,
        });
    };

    const viewInRoom = (evt: ButtonEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: props.mxEvent.getId(),
            highlighted: true,
            room_id: props.mxEvent.getRoomId(),
            metricsTrigger: undefined,
        });
    };

    const copyLinkToThread = async (evt: ButtonEvent): Promise<void> => {
        evt.preventDefault();
        evt.stopPropagation();
        if (!props.permalinkCreator) return;
        await copyPlaintext(props.permalinkCreator.forEvent(props.mxEvent.getId()!));
    };

    const onListTileClick = (ev: MouseEvent<HTMLElement>): void => {
        const target = ev.currentTarget as HTMLElement;
        let index = -1;
        if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

        switch (vmSnapshot.tileClickMode) {
            case "viewRoom":
                viewInRoom(ev as never);
                break;
            case "showThread":
                dis.dispatch<ShowThreadPayload>({
                    action: Action.ShowThread,
                    rootEvent: props.mxEvent,
                    push: true,
                });
                PosthogTrackers.trackInteraction("WebThreadsPanelThreadItem", ev, index);
                break;
        }
    };

    const messageBody: ReactNode =
        roomContext.timelineRenderingType === TimelineRenderingType.Notification ||
        roomContext.timelineRenderingType === TimelineRenderingType.ThreadsList ? (
            props.mxEvent.isRedacted() ? (
                <RedactedBody mxEvent={props.mxEvent} />
            ) : props.mxEvent.isDecryptionFailure() ? (
                <EventTileDecryptionFailureBody mxEvent={props.mxEvent} />
            ) : (
                <EventPreview mxEvent={props.mxEvent} />
            )
        ) : (
            renderTile(vmSnapshot.tileRenderType, {
                ...renderTileProps,
                permalinkCreator: props.permalinkCreator,
                showHiddenEvents: roomContext.showHiddenEvents,
                isSeeingThroughMessageHiddenForModeration: vmSnapshot.isSeeingThroughMessageHiddenForModeration,
            })
        );

    return (
        <EventTileComposer
            as={props.as}
            mxEvent={props.mxEvent}
            layout={props.layout}
            highlightLink={props.highlightLink}
            readReceipts={props.readReceipts}
            readReceiptMap={props.readReceiptMap}
            checkUnmounting={props.checkUnmounting}
            eventSendStatus={props.eventSendStatus}
            isTwelveHour={props.isTwelveHour}
            vm={vm}
            vmSnapshot={vmSnapshot}
            messageBody={messageBody}
            onPermalinkClicked={onPermalinkClicked}
            viewInRoom={viewInRoom}
            copyLinkToThread={copyLinkToThread}
            onListTileClick={onListTileClick}
        />
    );
}
