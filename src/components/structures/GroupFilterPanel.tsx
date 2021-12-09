/*
Copyright 2017, 2018 New Vector Ltd.
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

import type { EventSubscription } from "fbemitter";
import React from 'react';
import GroupFilterOrderStore from '../../stores/GroupFilterOrderStore';

import GroupActions from '../../actions/GroupActions';

import dis from '../../dispatcher/dispatcher';
import { _t } from '../../languageHandler';

import classNames from 'classnames';
import MatrixClientContext from "../../contexts/MatrixClientContext";
import AutoHideScrollbar from "./AutoHideScrollbar";
import SettingsStore from "../../settings/SettingsStore";
import UserTagTile from "../views/elements/UserTagTile";
import { replaceableComponent } from "../../utils/replaceableComponent";
import UIStore from "../../stores/UIStore";
import DNDTagTile from "../views/elements/DNDTagTile";
import ActionButton from "../views/elements/ActionButton";

interface IGroupFilterPanelProps {

}

// FIXME: Properly type this after migrating GroupFilterOrderStore.js to Typescript
type OrderedTagsTemporaryType = Array<{}>;
// FIXME: Properly type this after migrating GroupFilterOrderStore.js to Typescript
type SelectedTagsTemporaryType = Array<{}>;

interface IGroupFilterPanelState {
    // FIXME: Properly type this after migrating GroupFilterOrderStore.js to Typescript
    orderedTags: OrderedTagsTemporaryType;
    // FIXME: Properly type this after migrating GroupFilterOrderStore.js to Typescript
    selectedTags: SelectedTagsTemporaryType;
}

@replaceableComponent("structures.GroupFilterPanel")
class GroupFilterPanel extends React.Component<IGroupFilterPanelProps, IGroupFilterPanelState> {
    public static contextType = MatrixClientContext;

    public state = {
        orderedTags: [],
        selectedTags: [],
    };

    private ref = React.createRef<HTMLDivElement>();
    private unmounted = false;
    private groupFilterOrderStoreToken?: EventSubscription;

    public componentDidMount() {
        this.unmounted = false;
        this.context.on("Group.myMembership", this.onGroupMyMembership);
        this.context.on("sync", this.onClientSync);

        this.groupFilterOrderStoreToken = GroupFilterOrderStore.addListener(() => {
            if (this.unmounted) {
                return;
            }
            this.setState({
                orderedTags: GroupFilterOrderStore.getOrderedTags() || [],
                selectedTags: GroupFilterOrderStore.getSelectedTags(),
            });
        });
        // This could be done by anything with a matrix client
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context));
        UIStore.instance.trackElementDimensions("GroupPanel", this.ref.current);
    }

    public componentWillUnmount() {
        this.unmounted = true;
        this.context.removeListener("Group.myMembership", this.onGroupMyMembership);
        this.context.removeListener("sync", this.onClientSync);
        if (this.groupFilterOrderStoreToken) {
            this.groupFilterOrderStoreToken.remove();
        }
        UIStore.instance.stopTrackingElementDimensions("GroupPanel");
    }

    private onGroupMyMembership = () => {
        if (this.unmounted) return;
        dis.dispatch(GroupActions.fetchJoinedGroups(this.context));
    };

    private onClientSync = (syncState, prevState) => {
        // Consider the client reconnected if there is no error with syncing.
        // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
        const reconnected = syncState !== "ERROR" && prevState !== syncState;
        if (reconnected) {
            // Load joined groups
            dis.dispatch(GroupActions.fetchJoinedGroups(this.context));
        }
    };

    private onClick = e => {
        // only dispatch if its not a no-op
        if (this.state.selectedTags.length > 0) {
            dis.dispatch({ action: 'deselect_tags' });
        }
    };

    private onClearFilterClick = ev => {
        dis.dispatch({ action: 'deselect_tags' });
    };

    private renderGlobalIcon() {
        if (!SettingsStore.getValue("feature_communities_v2_prototypes")) return null;

        return (
            <div>
                <UserTagTile />
                <hr className="mx_GroupFilterPanel_divider" />
            </div>
        );
    }

    public render() {
        const tags = this.state.orderedTags.map((tag, index) => {
            return <DNDTagTile
                key={tag}
                tag={tag}
                index={index}
                selected={this.state.selectedTags.includes(tag)}
            />;
        });

        const itemsSelected = this.state.selectedTags.length > 0;
        const classes = classNames('mx_GroupFilterPanel', {
            mx_GroupFilterPanel_items_selected: itemsSelected,
        });

        let createButton = (
            <ActionButton
                tooltip
                label={_t("Communities")}
                action="toggle_my_groups"
                className="mx_TagTile mx_TagTile_plus"
            />
        );

        if (SettingsStore.getValue("feature_communities_v2_prototypes")) {
            createButton = (
                <ActionButton
                    tooltip
                    label={_t("Create community")}
                    action="view_create_group"
                    className="mx_TagTile mx_TagTile_plus" />
            );
        }

        return <div className={classes} onClick={this.onClearFilterClick} ref={this.ref}>
            <AutoHideScrollbar
                className="mx_GroupFilterPanel_scroller"
                onClick={this.onClick}
            >
                <div className="mx_GroupFilterPanel_tagTileContainer">
                    { this.renderGlobalIcon() }
                    { tags }
                    <div>
                        { createButton }
                    </div>
                </div>
            </AutoHideScrollbar>
        </div>;
    }
}
export default GroupFilterPanel;
