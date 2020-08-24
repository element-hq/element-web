/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import * as fbEmitter from "fbemitter";
import TagOrderStore from "../../../stores/TagOrderStore";
import AccessibleTooltipButton from "./AccessibleTooltipButton";
import BaseAvatar from "../avatars/BaseAvatar";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import classNames from "classnames";

interface IProps{}

interface IState {
    selected: boolean;
}

export default class UserTagTile extends React.PureComponent<IProps, IState> {
    private tagStoreRef: fbEmitter.EventSubscription;

    constructor(props: IProps) {
        super(props);

        this.state = {
            selected: TagOrderStore.getSelectedTags().length === 0,
        };
    }

    public componentDidMount() {
        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileUpdate);
        this.tagStoreRef = TagOrderStore.addListener(this.onTagStoreUpdate);
    }

    public componentWillUnmount() {
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
    }

    private onProfileUpdate = () => {
        this.forceUpdate();
    };

    private onTagStoreUpdate = () => {
        const selected = TagOrderStore.getSelectedTags().length === 0;
        this.setState({selected});
    };

    private onTileClick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        // Deselect all tags
        defaultDispatcher.dispatch({action: "deselect_tags"});
    };

    public render() {
        // XXX: We reuse TagTile classes for ease of demonstration - we should probably generify
        // TagTile instead if we continue to use this component.
        const avatarHeight = 36;
        const name = OwnProfileStore.instance.displayName || MatrixClientPeg.get().getUserId();
        const className = classNames({
            mx_TagTile: true,
            mx_TagTile_selected: this.state.selected,
            mx_TagTile_large: true,
        });
        return (
            <AccessibleTooltipButton
                className={className}
                onClick={this.onTileClick}
                title={name}
            >
                <div className="mx_TagTile_avatar">
                    <BaseAvatar
                        name={name}
                        idName={MatrixClientPeg.get().getUserId()}
                        url={OwnProfileStore.instance.getHttpAvatarUrl(avatarHeight)}
                        width={avatarHeight}
                        height={avatarHeight}
                    />
                </div>
            </AccessibleTooltipButton>
        );
    }
}
