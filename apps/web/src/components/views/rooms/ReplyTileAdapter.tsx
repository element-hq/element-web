/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { EventType, MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { ReplyTileView, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { type GetRelationsForEvent } from "./EventTile";
import { type IBodyProps } from "../messages/IBodyProps";
import MImageReplyBody from "../messages/MImageReplyBody";
import MVoiceMessageBody from "../messages/MVoiceMessageBody";
import SenderProfile from "../messages/SenderProfile";
import MemberAvatar from "../avatars/MemberAvatar";
import { FileBodyFactory, VideoBodyFactory, renderMBody } from "../messages/MBodyFactory";
import { renderReplyTile } from "../../../events/EventTileFactory";
import { isVoiceMessage } from "../../../utils/EventUtils";
import { ReplyTileViewModel } from "../../../viewmodels/room/timeline/event-tile/ReplyTileViewModel";

interface ReplyTileAdapterProps {
    /** Matrix event rendered inside the reply tile. */
    mxEvent: MatrixEvent;
    /** Optional permalink creator for the event link. */
    permalinkCreator?: RoomPermalinkCreator;
    /** Highlight terms forwarded to the rendered reply body. */
    highlights?: string[];
    /** Highlight link forwarded to the rendered reply body. */
    highlightLink?: string;
    /** Optional callback for expanding/collapsing a quoted reply chain. */
    toggleExpandedQuote?: () => void;
    /** Helper function to access relations for this event. */
    getRelationsForEvent?: GetRelationsForEvent;
}

const ReplyTileFileBody: React.ComponentType<IBodyProps> = (props) => renderMBody(props, FileBodyFactory);

/**
 * Bridges Matrix-specific reply tile rendering to the shared ReplyTile view.
 */
export function ReplyTileAdapter({
    mxEvent,
    permalinkCreator,
    highlights,
    highlightLink,
    toggleExpandedQuote,
    getRelationsForEvent,
}: Readonly<ReplyTileAdapterProps>): JSX.Element {
    const client = MatrixClientPeg.safeGet();
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ReplyTileViewModel({
                client,
                mxEvent,
                permalinkCreator,
                toggleExpandedQuote,
            }),
    );

    useEffect(() => {
        vm.setClient(client);
    }, [client, vm]);

    useEffect(() => {
        vm.setEvent(mxEvent);
    }, [mxEvent, vm]);

    useEffect(() => {
        vm.setPermalinkCreator(permalinkCreator);
    }, [permalinkCreator, vm]);

    useEffect(() => {
        vm.setToggleExpandedQuote(toggleExpandedQuote);
    }, [toggleExpandedQuote, vm]);

    const snapshot = useViewModel(vm);
    const sender = snapshot.showSender ? (
        <>
            <MemberAvatar member={mxEvent.sender} fallbackUserId={mxEvent.getSender()} size="16px" />
            <span data-reply-tile-sender-profile="">
                <SenderProfile mxEvent={mxEvent} />
            </span>
        </>
    ) : undefined;

    const msgtypeOverrides: Record<string, React.ComponentType<IBodyProps>> = {
        [MsgType.Image]: MImageReplyBody,
        [MsgType.Audio]: isVoiceMessage(mxEvent) ? MVoiceMessageBody : ReplyTileFileBody,
        [MsgType.Video]: VideoBodyFactory,
    };
    const evOverrides: Record<string, React.ComponentType<IBodyProps>> = {
        [EventType.Sticker]: MImageReplyBody,
    };

    const body = snapshot.noRendererMessage
        ? undefined
        : renderReplyTile(
              {
                  mxEvent,
                  ref: undefined,
                  showUrlPreview: false,
                  overrideBodyTypes: msgtypeOverrides,
                  overrideEventTypes: evOverrides,
                  maxImageHeight: 96,
                  isSeeingThroughMessageHiddenForModeration: snapshot.isSeeingThroughMessageHiddenForModeration,
                  highlights,
                  highlightLink,
                  permalinkCreator,
                  showHiddenEvents: false,
                  getRelationsForEvent,
              },
              false,
              client,
          );

    return (
        <ReplyTileView vm={vm} sender={sender}>
            {body}
        </ReplyTileView>
    );
}
