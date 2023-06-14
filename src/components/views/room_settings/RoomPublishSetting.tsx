/*
Copyright 2020 - 2021 The Matrix.org Foundation C.I.C.

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
import { JoinRule, Visibility } from "matrix-js-sdk/src/@types/partials";

import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import DirectoryCustomisations from "../../../customisations/Directory";

interface IProps {
    roomId: string;
    label?: string;
    canSetCanonicalAlias?: boolean;
}

interface IState {
    isRoomPublished: boolean;
}

export default class RoomPublishSetting extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            isRoomPublished: false,
        };
    }

    private onRoomPublishChange = (): void => {
        const valueBefore = this.state.isRoomPublished;
        const newValue = !valueBefore;
        this.setState({ isRoomPublished: newValue });
        const client = MatrixClientPeg.get();

        client
            .setRoomDirectoryVisibility(this.props.roomId, newValue ? Visibility.Public : Visibility.Private)
            .catch(() => {
                // Roll back the local echo on the change
                this.setState({ isRoomPublished: valueBefore });
            });
    };

    public componentDidMount(): void {
        const client = MatrixClientPeg.get();
        client.getRoomDirectoryVisibility(this.props.roomId).then((result) => {
            this.setState({ isRoomPublished: result.visibility === "public" });
        });
    }

    public render(): React.ReactNode {
        const client = MatrixClientPeg.get();

        const room = client.getRoom(this.props.roomId);
        const isRoomPublishable = room && room.getJoinRule() !== JoinRule.Invite;

        const enabled =
            (DirectoryCustomisations.requireCanonicalAliasAccessToPublish?.() === false ||
                this.props.canSetCanonicalAlias) &&
            (isRoomPublishable || this.state.isRoomPublished);

        return (
            <LabelledToggleSwitch
                value={this.state.isRoomPublished}
                onChange={this.onRoomPublishChange}
                disabled={!enabled}
                label={_t("Publish this room to the public in %(domain)s's room directory?", {
                    domain: client.getDomain(),
                })}
            />
        );
    }
}
