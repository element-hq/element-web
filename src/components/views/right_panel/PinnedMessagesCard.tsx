/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, type JSX, useContext } from "react";
import { type Room, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { Button, Separator } from "@vector-im/compound-web";
import classNames from "classnames";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin";

import { _t } from "../../../languageHandler";
import BaseCard from "./BaseCard";
import Spinner from "../elements/Spinner";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { PinnedEventTile } from "../rooms/PinnedEventTile";
import { useRoomState } from "../../../hooks/useRoomState";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { ReadPinsEventId } from "./types";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { filterBoolean } from "../../../utils/arrays";
import Modal from "../../../Modal";
import { UnpinAllDialog } from "../dialogs/UnpinAllDialog";
import EmptyState from "./EmptyState";
import { usePinnedEvents, useReadPinnedEvents, useSortedFetchedPinnedEvents } from "../../../hooks/usePinnedEvents";
import PinningUtils from "../../../utils/PinningUtils.ts";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";

/**
 * List the pinned messages in a room inside a Card.
 */
interface PinnedMessagesCardProps {
    /**
     * The room to list the pinned messages for.
     */
    room: Room;
    /**
     * Permalink of the room.
     */
    permalinkCreator: RoomPermalinkCreator;
    /**
     * Callback for when the card is closed.
     */
    onClose(): void;
}

export function PinnedMessagesCard({ room, onClose, permalinkCreator }: PinnedMessagesCardProps): JSX.Element {
    const cli = useMatrixClientContext();
    const roomContext = useContext(RoomContext);
    const pinnedEventIds = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);
    const pinnedEvents = useSortedFetchedPinnedEvents(room, pinnedEventIds);

    useEffect(() => {
        if (!cli || cli.isGuest()) return; // nothing to do
        const newlyRead = pinnedEventIds.filter((id) => !readPinnedEvents.has(id));
        if (newlyRead.length > 0) {
            // clear out any read pinned events which no longer are pinned
            cli.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: pinnedEventIds,
            });
        }
    }, [cli, room.roomId, pinnedEventIds, readPinnedEvents]);

    let content: JSX.Element;
    if (!pinnedEventIds.length) {
        content = (
            <EmptyState
                Icon={PinIcon}
                title={_t("right_panel|pinned_messages|empty_title")}
                description={_t("right_panel|pinned_messages|empty_description", {
                    pinAction: _t("action|pin"),
                })}
            />
        );
    } else if (pinnedEvents?.length) {
        content = (
            <PinnedMessages events={filterBoolean(pinnedEvents)} room={room} permalinkCreator={permalinkCreator} />
        );
    } else {
        content = <Spinner />;
    }

    return (
        <BaseCard
            header={_t("right_panel|pinned_messages|header", { count: pinnedEventIds.length })}
            className="mx_PinnedMessagesCard"
            onClose={onClose}
        >
            <ScopedRoomContextProvider {...roomContext} timelineRenderingType={TimelineRenderingType.Pinned}>
                {content}
            </ScopedRoomContextProvider>
        </BaseCard>
    );
}

/**
 * The pinned messages in a room.
 */
interface PinnedMessagesProps {
    /**
     * The pinned events.
     */
    events: MatrixEvent[];
    /**
     * The room the events are in.
     */
    room: Room;
    /**
     * The permalink creator to use.
     */
    permalinkCreator: RoomPermalinkCreator;
}

/**
 * The pinned messages in a room.
 */
function PinnedMessages({ events, room, permalinkCreator }: PinnedMessagesProps): JSX.Element {
    const matrixClient = useMatrixClientContext();

    /**
     * Whether the client can unpin events from the room.
     * Listen to room state to update this value.
     */
    const canUnpin = useRoomState(room, () => PinningUtils.userHasPinOrUnpinPermission(matrixClient, room));

    /**
     * Opens the unpin all dialog.
     */
    const onUnpinAll = useCallback(async (): Promise<void> => {
        Modal.createDialog(UnpinAllDialog, {
            roomId: room.roomId,
            matrixClient,
        });
    }, [room, matrixClient]);

    return (
        <>
            <div
                className={classNames("mx_PinnedMessagesCard_wrapper", {
                    mx_PinnedMessagesCard_wrapper_unpin_all: canUnpin,
                })}
                role="list"
            >
                {events.map((event, i) => (
                    <>
                        <PinnedEventTile
                            key={event.getId()}
                            event={event}
                            permalinkCreator={permalinkCreator}
                            room={room}
                        />
                        {/* Add a separator if this isn't the last pinned message */}
                        {events.length - 1 !== i && (
                            <Separator key={`separator-${event.getId()}`} className="mx_PinnedMessagesCard_Separator" />
                        )}
                    </>
                ))}
            </div>
            {canUnpin && (
                <div className="mx_PinnedMessagesCard_unpin">
                    <Button kind="tertiary" onClick={onUnpinAll}>
                        {_t("right_panel|pinned_messages|unpin_all|button")}
                    </Button>
                </div>
            )}
        </>
    );
}
