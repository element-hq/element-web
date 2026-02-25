/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useContext, useState } from "react";
import { type Room, EventType } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { useTopic } from "../../../hooks/room/useTopic";
import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import Modal from "../../../Modal";
import InfoDialog from "../dialogs/InfoDialog";
import { useDispatcher } from "../../../hooks/useDispatcher";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AccessibleButton from "./AccessibleButton";
import { Linkify, topicToHtml } from "../../../HtmlUtils";
import { tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";

interface IProps extends React.HTMLProps<HTMLDivElement> {
    room: Room;
}

export function onRoomTopicLinkClick(e: React.MouseEvent): void {
    const anchor = e.target as HTMLLinkElement;
    const localHref = tryTransformPermalinkToLocalHref(anchor.href);

    if (localHref !== anchor.href) {
        // it could be converted to a localHref -> therefore handle locally
        e.preventDefault();
        window.location.hash = localHref;
    }
}

export default function RoomTopic({ room, className, ...props }: IProps): JSX.Element {
    const client = useContext(MatrixClientContext);
    const [disableTooltip, setDisableTooltip] = useState(false);

    const topic = useTopic(room);
    const body = topicToHtml(topic?.text, topic?.html);

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            props.onClick?.(e);

            const target = e.target as HTMLElement;

            if (target.tagName.toUpperCase() !== "A") {
                dis.fire(Action.ShowRoomTopic);
                return;
            }

            onRoomTopicLinkClick(e);
        },
        [props],
    );

    const onHover = (ev: React.MouseEvent | React.FocusEvent): void => {
        setDisableTooltip((ev.target as HTMLElement).tagName.toUpperCase() === "A");
    };

    useDispatcher(dis, (payload) => {
        if (payload.action === Action.ShowRoomTopic) {
            const canSetTopic = room.currentState.maySendStateEvent(EventType.RoomTopic, client.getSafeUserId());
            const body = topicToHtml(topic?.text, topic?.html, undefined, true);

            const modal = Modal.createDialog(InfoDialog, {
                title: room.name,
                description: (
                    <div>
                        <Linkify
                            options={{
                                attributes: {
                                    onClick(e: React.MouseEvent<HTMLDivElement>) {
                                        onClick(e);
                                        modal.close();
                                    },
                                },
                            }}
                            as="p"
                        >
                            {body}
                        </Linkify>
                        {canSetTopic && (
                            <AccessibleButton
                                kind="primary_outline"
                                onClick={() => {
                                    modal.close();
                                    dis.dispatch({ action: "open_room_settings" });
                                }}
                            >
                                {_t("room|edit_topic")}
                            </AccessibleButton>
                        )}
                    </div>
                ),
                hasCloseButton: true,
                button: false,
            });
        }
    });

    // Do not render the tooltip if the topic is empty
    // We still need to have a div for the header buttons to be displayed correctly
    if (!body) return <div className={classNames(className, "mx_RoomTopic")} />;

    return (
        <Tooltip description={_t("room|read_topic")} disabled={disableTooltip}>
            <div
                {...props}
                tabIndex={0}
                role="button"
                onClick={onClick}
                className={classNames(className, "mx_RoomTopic")}
                onMouseOver={onHover}
                onFocus={onHover}
                aria-label={_t("room|read_topic")}
            >
                <Linkify>{body}</Linkify>
            </div>
        </Tooltip>
    );
}
