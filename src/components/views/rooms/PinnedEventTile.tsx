/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useState } from "react";
import { EventTimeline, EventType, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { IconButton, Menu, MenuItem, Separator, Tooltip } from "@vector-im/compound-web";
import ViewIcon from "@vector-im/compound-design-tokens/assets/web/icons/visibility-on";
import UnpinIcon from "@vector-im/compound-design-tokens/assets/web/icons/unpin";
import ForwardIcon from "@vector-im/compound-design-tokens/assets/web/icons/forward";
import TriggerIcon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";
import DeleteIcon from "@vector-im/compound-design-tokens/assets/web/icons/delete";
import ThreadIcon from "@vector-im/compound-design-tokens/assets/web/icons/threads";
import classNames from "classnames";

import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import MessageEvent from "../messages/MessageEvent";
import MemberAvatar from "../avatars/MemberAvatar";
import { _t } from "../../../languageHandler";
import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useRoomState } from "../../../hooks/useRoomState";
import { isContentActionable } from "../../../utils/EventUtils";
import { getForwardableEvent } from "../../../events";
import { type OpenForwardDialogPayload } from "../../../dispatcher/payloads/OpenForwardDialogPayload";
import { createRedactEventDialog } from "../dialogs/ConfirmRedactDialog";
import { type ShowThreadPayload } from "../../../dispatcher/payloads/ShowThreadPayload";
import PinningUtils from "../../../utils/PinningUtils.ts";
import PosthogTrackers from "../../../PosthogTrackers.ts";

const AVATAR_SIZE = "32px";

/**
 * Properties for {@link PinnedEventTile}.
 */
interface PinnedEventTileProps {
    /**
     * The event to display.
     */
    event: MatrixEvent;
    /**
     * The permalink creator to use.
     */
    permalinkCreator: RoomPermalinkCreator;
    /**
     * The room the event is in.
     */
    room: Room;
}

/**
 * A pinned event tile.
 */
export function PinnedEventTile({ event, room, permalinkCreator }: PinnedEventTileProps): JSX.Element {
    const sender = event.getSender();
    if (!sender) {
        throw new Error("Pinned event unexpectedly has no sender");
    }

    const isInThread = Boolean(event.threadRootId);
    const displayThreadInfo = !event.isThreadRoot && isInThread;

    return (
        <div className="mx_PinnedEventTile" role="listitem">
            <div>
                <MemberAvatar
                    className="mx_PinnedEventTile_senderAvatar"
                    member={event.sender}
                    size={AVATAR_SIZE}
                    fallbackUserId={sender}
                />
            </div>
            <div className="mx_PinnedEventTile_wrapper">
                <div className="mx_PinnedEventTile_top">
                    <Tooltip label={event.sender?.name || sender}>
                        <span className={classNames("mx_PinnedEventTile_sender", getUserNameColorClass(sender))}>
                            {event.sender?.name || sender}
                        </span>
                    </Tooltip>
                    <PinMenu event={event} room={room} permalinkCreator={permalinkCreator} />
                </div>
                <MessageEvent
                    mxEvent={event}
                    maxImageHeight={150}
                    onHeightChanged={() => {}} // we need to give this, apparently
                    permalinkCreator={permalinkCreator}
                    replacingEventId={event.replacingEventId()}
                />
                {displayThreadInfo && (
                    <div className="mx_PinnedEventTile_thread">
                        <ThreadIcon />
                        {_t(
                            "right_panel|pinned_messages|reply_thread",
                            {},
                            {
                                link: (sub) => (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!event.threadRootId) return;

                                            const rootEvent = room.findEventById(event.threadRootId);
                                            if (!rootEvent) return;

                                            dis.dispatch<ShowThreadPayload>({
                                                action: Action.ShowThread,
                                                rootEvent: rootEvent,
                                                push: true,
                                            });
                                        }}
                                    >
                                        {sub}
                                    </button>
                                ),
                            },
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Properties for {@link PinMenu}.
 */
interface PinMenuProps extends PinnedEventTileProps {}

/**
 * A popover menu with actions on the pinned event
 */
function PinMenu({ event, room, permalinkCreator }: PinMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const matrixClient = useMatrixClientContext();

    /**
     * View the event in the timeline.
     */
    const onViewInTimeline = useCallback(() => {
        PosthogTrackers.trackInteraction("PinnedMessageListViewTimeline");

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: event.getId(),
            highlighted: true,
            room_id: event.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
    }, [event]);

    /**
     * Whether the client can unpin the event.
     * If the room state change, we want to check again the permission
     */
    const canUnpin = useRoomState(room, () => PinningUtils.canUnpin(matrixClient, event));

    /**
     * Unpin the event.
     * @param event
     */
    const onUnpin = useCallback(async (): Promise<void> => {
        await PinningUtils.pinOrUnpinEvent(matrixClient, event);
        PosthogTrackers.trackPinUnpinMessage("Unpin", "MessagePinningList");
    }, [event, matrixClient]);

    const contentActionable = isContentActionable(event);
    // Get the forwardable event for the given event
    const forwardableEvent = contentActionable && getForwardableEvent(event, matrixClient);
    /**
     * Open the forward dialog.
     */
    const onForward = useCallback(() => {
        if (forwardableEvent) {
            dis.dispatch<OpenForwardDialogPayload>({
                action: Action.OpenForwardDialog,
                event: forwardableEvent,
                permalinkCreator: permalinkCreator,
            });
        }
    }, [forwardableEvent, permalinkCreator]);

    /**
     * Whether the client can redact the event.
     */
    const canRedact =
        room
            .getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.maySendRedactionForEvent(event, matrixClient.getSafeUserId()) &&
        event.getType() !== EventType.RoomServerAcl &&
        event.getType() !== EventType.RoomEncryption;

    /**
     * Redact the event.
     */
    const onRedact = useCallback(
        (): void =>
            createRedactEventDialog({
                mxEvent: event,
            }),
        [event],
    );

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            showTitle={false}
            title={_t("right_panel|pinned_messages|menu")}
            side="right"
            align="start"
            trigger={
                <IconButton size="24px" aria-label={_t("right_panel|pinned_messages|menu")}>
                    <TriggerIcon />
                </IconButton>
            }
        >
            <MenuItem Icon={ViewIcon} label={_t("right_panel|pinned_messages|view")} onSelect={onViewInTimeline} />
            {canUnpin && <MenuItem Icon={UnpinIcon} label={_t("action|unpin")} onSelect={onUnpin} />}
            {forwardableEvent && <MenuItem Icon={ForwardIcon} label={_t("action|forward")} onSelect={onForward} />}
            {canRedact && (
                <>
                    <Separator />
                    <MenuItem kind="critical" Icon={DeleteIcon} label={_t("action|delete")} onSelect={onRedact} />
                </>
            )}
        </Menu>
    );
}
