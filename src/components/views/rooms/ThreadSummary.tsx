/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { type Thread, ThreadEvent, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { IndicatorIcon } from "@vector-im/compound-web";
import ThreadIconSolid from "@vector-im/compound-design-tokens/assets/web/icons/threads-solid";

import { _t } from "../../../languageHandler";
import { CardContext } from "../right_panel/context";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import PosthogTrackers from "../../../PosthogTrackers";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import MemberAvatar from "../avatars/MemberAvatar";
import { Action } from "../../../dispatcher/actions";
import { type ShowThreadPayload } from "../../../dispatcher/payloads/ShowThreadPayload";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { useUnreadNotifications } from "../../../hooks/useUnreadNotifications";
import { notificationLevelToIndicator } from "../../../utils/notifications";
import { EventPreviewTile, useEventPreview } from "./EventPreview.tsx";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";

interface IProps {
    mxEvent: MatrixEvent;
    thread: Thread;
}

const ThreadSummary: React.FC<IProps> = ({ mxEvent, thread, ...props }) => {
    const roomContext = useScopedRoomContext("narrow");
    const cardContext = useContext(CardContext);
    const count = useTypedEventEmitterState(thread, ThreadEvent.Update, () => thread.length);
    const { level } = useUnreadNotifications(thread.room, thread.id);

    if (!count) return null; // We don't want to show a thread summary if the thread doesn't have replies yet

    let countSection: string | number = count;
    if (!roomContext.narrow) {
        countSection = _t("threads|count_of_reply", { count });
    }

    return (
        <AccessibleButton
            {...props}
            className="mx_ThreadSummary"
            onClick={(ev: ButtonEvent) => {
                defaultDispatcher.dispatch<ShowThreadPayload>({
                    action: Action.ShowThread,
                    rootEvent: mxEvent,
                    push: cardContext.isCard,
                });
                PosthogTrackers.trackInteraction("WebRoomTimelineThreadSummaryButton", ev);
            }}
            aria-label={_t("threads|open_thread")}
        >
            <IndicatorIcon size="24px" indicator={notificationLevelToIndicator(level)}>
                <ThreadIconSolid />
            </IndicatorIcon>
            <span className="mx_ThreadSummary_replies_amount">{countSection}</span>
            <ThreadMessagePreview thread={thread} showDisplayname={!roomContext.narrow} />
            <div className="mx_ThreadSummary_chevron" />
        </AccessibleButton>
    );
};

interface IPreviewProps {
    thread: Thread;
    showDisplayname?: boolean;
}

export const ThreadMessagePreview: React.FC<IPreviewProps> = ({ thread, showDisplayname = false }) => {
    const lastReply = useTypedEventEmitterState(thread, ThreadEvent.Update, () => thread.replyToEvent) ?? undefined;
    const preview = useEventPreview(lastReply);

    if (!preview || !lastReply) {
        return null;
    }

    return (
        <>
            <MemberAvatar
                member={lastReply.sender}
                fallbackUserId={lastReply.getSender()}
                size="24px"
                className="mx_ThreadSummary_avatar"
            />
            {showDisplayname && (
                <div className="mx_ThreadSummary_sender">{lastReply.sender?.name ?? lastReply.getSender()}</div>
            )}

            {lastReply.isDecryptionFailure() ? (
                <div
                    className="mx_ThreadSummary_content mx_DecryptionFailureBody"
                    title={_t("timeline|decryption_failure|unable_to_decrypt")}
                >
                    {_t("timeline|decryption_failure|unable_to_decrypt")}
                </div>
            ) : (
                <EventPreviewTile preview={preview} className="mx_ThreadSummary_content" />
            )}
        </>
    );
};

export default ThreadSummary;
