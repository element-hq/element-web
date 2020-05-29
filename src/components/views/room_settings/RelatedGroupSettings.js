/*
Copyright 2017, 2019 New Vector Ltd.

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

import React from 'react';
import PropTypes from 'prop-types';
import {MatrixEvent} from 'matrix-js-sdk';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import ErrorDialog from "../dialogs/ErrorDialog";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

const GROUP_ID_REGEX = /\+\S+:\S+/;

export default class RelatedGroupSettings extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
        canSetRelatedGroups: PropTypes.bool.isRequired,
        relatedGroupsEvent: PropTypes.instanceOf(MatrixEvent),
    };

    static contextType = MatrixClientContext;

    static defaultProps = {
        canSetRelatedGroups: false,
    };

    constructor(props) {
        super(props);

        this.state = {
            newGroupId: "",
            newGroupsList: props.relatedGroupsEvent ? (props.relatedGroupsEvent.getContent().groups || []) : [],
        };
    }

    updateGroups(newGroupsList) {
        this.context.sendStateEvent(this.props.roomId, 'm.room.related_groups', {
            groups: newGroupsList,
        }, '').catch((err) => {
            console.error(err);
            Modal.createTrackedDialog('Error updating flair', '', ErrorDialog, {
                title: _t("Error updating flair"),
                description: _t(
                    "There was an error updating the flair for this room. The server may not allow it or " +
                    "a temporary error occurred.",
                ),
            });
        });
    }

    validateGroupId(groupId) {
        if (!GROUP_ID_REGEX.test(groupId)) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Invalid related community ID', '', ErrorDialog, {
                title: _t('Invalid community ID'),
                description: _t('\'%(groupId)s\' is not a valid community ID', { groupId }),
            });
            return false;
        }
        return true;
    }

    onNewGroupChanged = (newGroupId) => {
        this.setState({ newGroupId });
    };

    onGroupAdded = (groupId) => {
        if (groupId.length === 0 || !this.validateGroupId(groupId)) {
            return;
        }
        const newGroupsList = [...this.state.newGroupsList, groupId];
        this.setState({
            newGroupsList: newGroupsList,
            newGroupId: '',
        });
        this.updateGroups(newGroupsList);
    };

    onGroupDeleted = (index) => {
        const group = this.state.newGroupsList[index];
        const newGroupsList = this.state.newGroupsList.filter((g) => g !== group);
        this.setState({ newGroupsList });
        this.updateGroups(newGroupsList);
    };

    render() {
        const localDomain = this.context.getDomain();
        const EditableItemList = sdk.getComponent('elements.EditableItemList');
        return <div>
            <EditableItemList
                id="relatedGroups"
                items={this.state.newGroupsList}
                className={"mx_RelatedGroupSettings"}
                newItem={this.state.newGroupId}
                canRemove={this.props.canSetRelatedGroups}
                canEdit={this.props.canSetRelatedGroups}
                onNewItemChanged={this.onNewGroupChanged}
                onItemAdded={this.onGroupAdded}
                onItemRemoved={this.onGroupDeleted}
                itemsLabel={_t('Showing flair for these communities:')}
                noItemsLabel={_t('This room is not showing flair for any communities')}
                placeholder={_t(
                    'New community ID (e.g. +foo:%(localDomain)s)', {localDomain},
                )}
            />
        </div>;
    }
}
