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
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from "classnames";
import { EventType } from "matrix-js-sdk/src/@types/event";

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

interface IProps extends React.HTMLProps<HTMLDivElement> {
    room: Room;
}

export default function RoomTopic({ room, ...props }: IProps): JSX.Element {
    const client = useContext(MatrixClientContext);
    const ref = useRef<HTMLDivElement>(null);

    const topic = useTopic(room);
    const body = topicToHtml(topic?.text, topic?.html, ref);

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            props.onClick?.(e);
            const target = e.target as HTMLElement;
            if (target.tagName.toUpperCase() === "A") {
                return;
            }

            dis.fire(Action.ShowRoomTopic);
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
                                {_t("Edit topic")}
                            </AccessibleButton>
                        )}
                    </div>
                ),
                hasCloseButton: true,
                button: false,
            });
        }
    });

    const className = classNames(props.className, "mx_RoomTopic");

    return (
        <TooltipTarget
            {...props}
            ref={ref}
            onClick={onClick}
            dir="auto"
            tooltipTargetClassName={className}
            label={_t("Click to read topic")}
            alignment={Alignment.Bottom}
            ignoreHover={ignoreHover}
        >
            <Linkify>{body}</Linkify>
        </TooltipTarget>
    );
}
