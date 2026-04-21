/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, useImperativeHandle, useId, useMemo, useRef, useState, type JSX } from "react";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import RoomContext from "../../../../contexts/RoomContext";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import dis from "../../../../dispatcher/dispatcher";
import PosthogTrackers from "../../../../PosthogTrackers";
import PlatformPeg from "../../../../PlatformPeg";
import { Layout } from "../../../../settings/enums/Layout";
import { copyPlaintext } from "../../../../utils/strings";
import { EventTileView } from "./EventTileView";
import { EventTileErrorBoundary } from "./EventTileErrorBoundary";
import { EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import {
    buildEventTileViewModelProps,
    type EventTileHandle,
    type EventTileProps as EventTilePresenterProps,
    useEventTileCommands,
    useEventTileContextMenuNode,
    useEventTileNodes,
    useEventTileViewProps,
} from "./EventTilePresenter";
import type { EventTileOps } from "../../../../models/rooms/EventTileTypes";
import type ReplyChain from "../../elements/ReplyChain";
import { type EventTileCommandDeps } from "./EventTileCommands";
import { _t } from "../../../../languageHandler";

export type { EventTileHandle } from "./EventTilePresenter";
export type { EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "../../../../models/rooms/EventTileTypes";

/** Props for {@link EventTile}. */
export interface EventTileProps extends EventTilePresenterProps {
    /** Wraps the tile in {@link EventTileErrorBoundary}. Defaults to `true`. */
    withErrorBoundary?: boolean;
}

function EventTileBody({ ref: forwardedRef, ...props }: Readonly<EventTilePresenterProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const cli = useMatrixClientContext();
    const commandDeps = useMemo<EventTileCommandDeps>(
        () => ({
            dispatch: (payload) => dis.dispatch(payload),
            copyPlaintext,
            trackInteraction: (name, ev, index) => PosthogTrackers.trackInteraction(name, ev, index),
            allowOverridingNativeContextMenus: () => Boolean(PlatformPeg.get()?.allowOverridingNativeContextMenus()),
        }),
        [],
    );
    const tileContentId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const tileRef = useRef<EventTileOps>(null);
    const replyChainRef = useRef<ReplyChain>(null);
    const [suppressReadReceiptAnimation, setSuppressReadReceiptAnimation] = useState(true);
    const vmReadReceipts = useMemo(
        () => props.readReceipts?.map(({ userId, ts, roomMember }) => ({ userId, ts, roomMember })),
        [props.readReceipts],
    );
    const { showHiddenEvents, isRoomEncrypted, timelineRenderingType } = roomContext;
    const {
        mxEvent,
        eventSendStatus,
        editState,
        permalinkCreator,
        callEventGrouper,
        forExport,
        layout,
        isTwelveHour,
        alwaysShowTimestamps,
        isRedacted,
        continuation,
        last,
        lastInSection,
        contextual,
        isSelectedEvent,
        hideSender,
        hideTimestamp,
        inhibitInteraction,
        highlightLink,
        showReactions,
        getRelationsForEvent,
        showReadReceipts,
        lastSuccessful,
    } = props;
    const viewModelProps = useMemo(
        () =>
            buildEventTileViewModelProps(
                {
                    mxEvent,
                    eventSendStatus,
                    editState,
                    permalinkCreator,
                    callEventGrouper,
                    forExport,
                    layout,
                    isTwelveHour,
                    alwaysShowTimestamps,
                    isRedacted,
                    continuation,
                    last,
                    lastInSection,
                    contextual,
                    isSelectedEvent,
                    hideSender,
                    hideTimestamp,
                    inhibitInteraction,
                    highlightLink,
                    showReactions,
                    getRelationsForEvent,
                    readReceipts: props.readReceipts,
                    showReadReceipts,
                    lastSuccessful,
                },
                vmReadReceipts,
                cli,
                commandDeps,
                {
                    showHiddenEvents,
                    isRoomEncrypted,
                    timelineRenderingType,
                },
            ),
        [
            mxEvent,
            eventSendStatus,
            editState,
            permalinkCreator,
            callEventGrouper,
            forExport,
            layout,
            isTwelveHour,
            alwaysShowTimestamps,
            isRedacted,
            continuation,
            last,
            lastInSection,
            contextual,
            isSelectedEvent,
            hideSender,
            hideTimestamp,
            inhibitInteraction,
            highlightLink,
            showReactions,
            getRelationsForEvent,
            props.readReceipts,
            showReadReceipts,
            lastSuccessful,
            vmReadReceipts,
            cli,
            commandDeps,
            showHiddenEvents,
            isRoomEncrypted,
            timelineRenderingType,
        ],
    );
    const vm = useCreateAutoDisposedViewModel(() => new EventTileViewModel(viewModelProps));

    useEffect(() => {
        vm.refreshVerification();
    }, [vm]);

    useImperativeHandle(
        forwardedRef,
        (): EventTileHandle => ({
            ref: rootRef,
            forceUpdate: () => vm.refreshDerivedState(),
            isWidgetHidden: () => tileRef.current?.isWidgetHidden?.() ?? false,
            unhideWidget: () => tileRef.current?.unhideWidget?.(),
            getMediaHelper: () => tileRef.current?.getMediaHelper?.(),
        }),
        [vm],
    );

    useEffect(() => {
        vm.updateProps(viewModelProps);
    }, [viewModelProps, vm]);

    const snapshot = useViewModel(vm);

    useEffect(() => {
        const rootNode = rootRef.current;
        if (!props.resizeObserver || !rootNode) return;

        props.resizeObserver.observe(rootNode);

        return () => {
            props.resizeObserver?.unobserve(rootNode);
        };
    }, [props.resizeObserver, props.as, roomContext.timelineRenderingType, snapshot.hasRenderer]);

    useEffect(() => {
        setSuppressReadReceiptAnimation(false);
    }, []);

    const {
        room,
        onPermalinkClicked,
        openInRoom,
        copyLinkToThread,
        onContextMenu,
        onTimestampContextMenu,
        onListTileClick,
    } = useEventTileCommands(props, cli, vm);
    const onActionBarFocusChange = React.useCallback(
        (focused: boolean): void => {
            vm.onActionBarFocusChange(focused, rootRef.current?.matches(":hover") ?? false);
        },
        [vm, rootRef],
    );
    const toggleThreadExpanded = React.useCallback((): void => {
        vm.toggleQuoteExpanded();
    }, [vm]);
    const nodes = useEventTileNodes({
        props,
        roomContext,
        snapshot,
        tileRef,
        replyChainRef,
        suppressReadReceiptAnimation,
        tileContentId,
        vm,
        onActionBarFocusChange,
        toggleThreadExpanded,
        openInRoom,
        copyLinkToThread,
    });
    const contextMenuNode = useEventTileContextMenuNode({
        props,
        snapshot,
        tileRef,
        replyChainRef,
        vm,
    });
    const eventTileViewProps = useEventTileViewProps({
        props,
        vm,
        snapshot,
        roomContext,
        room,
        tileContentId,
        rootRef,
        contentNodes: nodes.content,
        threadNodes: nodes.thread,
        contextMenuNode,
        actions: {
            onContextMenu,
            onPermalinkClicked,
            onTimestampContextMenu,
            openInRoom,
            copyLinkToThread,
            onListTileClick,
        },
    });

    if (snapshot.shouldRenderMissingRendererFallback) {
        return (
            <div ref={rootRef as React.Ref<HTMLDivElement>} className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
            </div>
        );
    }

    return <EventTileView {...eventTileViewProps} />;
}

/** Renders a single timeline event tile directly from its view model. */
export function EventTile(props: Readonly<EventTileProps>): JSX.Element {
    const { withErrorBoundary = true, layout = Layout.Group, forExport = false, ...rest } = props;
    const tileProps = { ...rest, layout, forExport };
    const tile = <EventTileBody {...tileProps} />;

    if (!withErrorBoundary) {
        return tile;
    }

    return (
        <EventTileErrorBoundary mxEvent={tileProps.mxEvent} layout={tileProps.layout}>
            {tile}
        </EventTileErrorBoundary>
    );
}
