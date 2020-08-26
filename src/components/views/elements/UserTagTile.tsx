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
import * as fbEmitter from "fbemitter";
import TagOrderStore from "../../../stores/TagOrderStore";
import AccessibleTooltipButton from "./AccessibleTooltipButton";
import classNames from "classnames";
import { _t } from "../../../languageHandler";

interface IProps {
}

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
        this.tagStoreRef = TagOrderStore.addListener(this.onTagStoreUpdate);
    }

    public componentWillUnmount() {
        this.tagStoreRef.remove();
    }

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
        const className = classNames({
            mx_TagTile: true,
            mx_TagTile_prototype: true,
            mx_TagTile_selected_prototype: this.state.selected,
            mx_TagTile_home: true,
        });
        return (
            <AccessibleTooltipButton
                className={className}
                onClick={this.onTileClick}
                title={_t("Home")}
            >
                <div className="mx_TagTile_avatar">
                    <div className="mx_TagTile_homeIcon" />
                </div>
            </AccessibleTooltipButton>
        );
    }
}
