/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useCallback, useContext, useRef } from "react";
import { Room, EventType } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { useTopic } from "../../../hooks/room/useTopic";
import { Alignment } from "./Tooltip";
import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import Modal from "../../../Modal";
import InfoDialog from "../dialogs/InfoDialog";
import { useDispatcher } from "../../../hooks/useDispatcher";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AccessibleButton from "./AccessibleButton";
import TooltipTarget from "./TooltipTarget";
import { Linkify, topicToHtml } from "../../../HtmlUtils";
import { tryTransformPermalinkToLocalHref } from "../../../utils/permalinks/Permalinks";

interface IProps extends React.HTMLProps<HTMLDivElement> {
    room: Room;
}

export default function RoomTopic({ room, className, ...props }: IProps): JSX.Element {
    const client = useContext(MatrixClientContext);
    const ref = useRef<HTMLDivElement>(null);

    const topic = useTopic(room);
    const body = topicToHtml(topic?.text, topic?.html, ref);

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            props.onClick?.(e);

            const target = e.target as HTMLElement;

            if (target.tagName.toUpperCase() !== "A") {
                dis.fire(Action.ShowRoomTopic);
                return;
            }

            const anchor = e.target as HTMLLinkElement;
            const localHref = tryTransformPermalinkToLocalHref(anchor.href);

            if (localHref !== anchor.href) {
                // it could be converted to a localHref -> therefore handle locally
                e.preventDefault();
                window.location.hash = localHref;
            }
        },
        [props],
    );

    const ignoreHover = (ev: React.MouseEvent): boolean => {
        return (ev.target as HTMLElement).tagName.toUpperCase() === "A";
    };

    useDispatcher(dis, (payload) => {
        if (payload.action === Action.ShowRoomTopic) {
            const canSetTopic = room.currentState.maySendStateEvent(EventType.RoomTopic, client.getSafeUserId());
            const body = topicToHtml(topic?.text, topic?.html, ref, true);

            const modal = Modal.createDialog(InfoDialog, {
                title: room.name,
                description: (
                    <div>
                        <Linkify
                            options={{
                                attributes: {
                                    onClick() {
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

    return (
        <TooltipTarget
            {...props}
            ref={ref}
            onClick={onClick}
            dir="auto"
            tooltipTargetClassName={classNames(className, "mx_RoomTopic")}
            label={_t("room|read_topic")}
            alignment={Alignment.Bottom}
            ignoreHover={ignoreHover}
        >
            <Linkify>{body}</Linkify>
        </TooltipTarget>
    );
}
