/*
Copyright 2017 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import AccessibleButton from "../elements/AccessibleButton";
import { mediaFromMxc } from "../../../customisations/Media";
import RoomAvatar from "../avatars/RoomAvatar";
import ImageView from "../elements/ImageView";
interface IProps {
    /* the MatrixEvent to show */
    mxEvent: MatrixEvent;
}

export default class RoomAvatarEvent extends React.Component<IProps> {
    private onAvatarClick = (): void => {
        const cli = MatrixClientPeg.get();
        const ev = this.props.mxEvent;
        const httpUrl = mediaFromMxc(ev.getContent().url).srcHttp;
        if (!httpUrl) return;

        const room = cli.getRoom(this.props.mxEvent.getRoomId());
        const text = _t("%(senderDisplayName)s changed the avatar for %(roomName)s", {
            senderDisplayName: ev.sender && ev.sender.name ? ev.sender.name : ev.getSender(),
            roomName: room ? room.name : "",
        });

        const params = {
            src: httpUrl,
            name: text,
        };
        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    };

    public render(): React.ReactNode {
        const ev = this.props.mxEvent;
        const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

        if (!ev.getContent().url || ev.getContent().url.trim().length === 0) {
            return (
                <div className="mx_TextualEvent">
                    {_t("%(senderDisplayName)s removed the room avatar.", { senderDisplayName })}
                </div>
            );
        }

        const room = MatrixClientPeg.get().getRoom(ev.getRoomId());
        // Provide all arguments to RoomAvatar via oobData because the avatar is historic
        const oobData = {
            avatarUrl: ev.getContent().url,
            name: room ? room.name : "",
        };

        return (
            <div className="mx_RoomAvatarEvent">
                {_t(
                    "%(senderDisplayName)s changed the room avatar to <img/>",
                    { senderDisplayName: senderDisplayName },
                    {
                        img: () => (
                            <AccessibleButton
                                key="avatar"
                                className="mx_RoomAvatarEvent_avatar"
                                onClick={this.onAvatarClick}
                            >
                                <RoomAvatar width={14} height={14} oobData={oobData} />
                            </AccessibleButton>
                        ),
                    },
                )}
            </div>
        );
    }
}
