/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useEffect, useImperativeHandle, type JSX, type Ref } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { ReplyChainView } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import SettingsStore from "../../../../settings/SettingsStore";
import { makeUserPermalink, type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { Pill } from "../../elements/Pill";
import { PillType } from "../../elements/PillType";
import ReplyTile from "../ReplyTile";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { type GetRelationsForEvent } from "../../../../viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";

export interface ReplyChainHandle {
    /** Whether the chain currently contains more than one loaded quote. */
    canCollapse: () => boolean;
    /** Reloads the chain from the first quoted event. */
    collapse: () => void;
}

interface ReplyChainAdapterProps {
    /** Imperative handle used by EventTile context-menu actions. */
    ref?: Ref<ReplyChainHandle>;
    /** EventTile view model owning the child ReplyChain view model lifecycle. */
    eventTileViewModel: EventTileViewModel;
    /** Event rendered by the parent EventTile. */
    parentEv: MatrixEvent;
    /** Whether the tile is being rendered for export. */
    forExport?: boolean;
    /** Current quote expansion state controlled by EventTile. */
    isQuoteExpanded?: boolean;
    /** Updates the quote expansion state controlled by EventTile. */
    setQuoteExpanded: (isExpanded: boolean) => void;
    /** Relation lookup used by the application-owned ReplyTile. */
    getRelationsForEvent?: GetRelationsForEvent;
    /** Room permalink creator used by the application-owned ReplyTile. */
    permalinkCreator?: RoomPermalinkCreator;
}

/** Wires the shared ReplyChainView to Matrix/Element-specific renderers and behavior. */
export function ReplyChainAdapter({
    eventTileViewModel,
    parentEv,
    forExport,
    isQuoteExpanded,
    setQuoteExpanded,
    getRelationsForEvent,
    permalinkCreator,
    ref,
}: Readonly<ReplyChainAdapterProps>): JSX.Element {
    const cli = useMatrixClientContext() ?? MatrixClientPeg.safeGet();
    const vm = eventTileViewModel.getReplyChainViewModel({
        cli,
        parentEv,
        forExport,
        isQuoteExpanded,
        setQuoteExpanded,
    });

    useImperativeHandle(
        ref,
        () => ({
            canCollapse: vm.canCollapse,
            collapse: vm.collapse,
        }),
        [vm],
    );

    useEffect(() => {
        // This child VM owns event-loading state and must be released when the adapter leaves the tree.
        return () => eventTileViewModel.releaseReplyChainViewModel();
    }, [eventTileViewModel]);

    useEffect(() => {
        vm.setProps({
            cli,
            parentEv,
            forExport,
            isQuoteExpanded,
            setQuoteExpanded,
        });
    }, [cli, forExport, isQuoteExpanded, parentEv, setQuoteExpanded, vm]);

    return (
        <ReplyChainView
            vm={vm}
            renderHeaderPill={(eventId) => {
                const event = vm.getEventById(eventId);
                if (!event) return null;

                return (
                    <Pill
                        type={PillType.UserMention}
                        room={cli.getRoom(event.getRoomId()) ?? undefined}
                        url={makeUserPermalink(event.getSender()!)}
                        shouldShowPillAvatar={SettingsStore.getValue("Pill.shouldShowPillAvatar")}
                    />
                );
            }}
            renderReplyTile={({ id }) => {
                const event = vm.getEventById(id);
                if (!event) return null;

                return (
                    <ReplyTile
                        mxEvent={event}
                        permalinkCreator={permalinkCreator}
                        toggleExpandedQuote={() => vm.setQuoteExpanded(vm.getSnapshot().isQuoteExpanded !== true)}
                        getRelationsForEvent={getRelationsForEvent}
                    />
                );
            }}
        />
    );
}
