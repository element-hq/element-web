/*
Copyright 2017 New Vector Ltd.

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
import {MatrixEvent, MatrixClient} from 'matrix-js-sdk';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import isEqual from 'lodash/isEqual';

const GROUP_ID_REGEX = /\+\S+\:\S+/;

module.exports = React.createClass({
    displayName: 'RelatedGroupSettings',

    propTypes: {
        roomId: PropTypes.string.isRequired,
        canSetRelatedGroups: PropTypes.bool.isRequired,
        relatedGroupsEvent: PropTypes.instanceOf(MatrixEvent),
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getDefaultProps: function() {
        return {
            canSetRelatedGroups: false,
        };
    },

    getInitialState: function() {
        return {
            newGroupsList: this.getInitialGroupList(),
            newGroupId: null,
        };
    },

    getInitialGroupList: function() {
        return this.props.relatedGroupsEvent ? (this.props.relatedGroupsEvent.getContent().groups || []) : [];
    },

    needsSaving: function() {
        const cli = this.context.matrixClient;
        const room = cli.getRoom(this.props.roomId);
        if (!room.currentState.maySendStateEvent('m.room.related_groups', cli.getUserId())) return false;
        return !isEqual(this.getInitialGroupList(), this.state.newGroupsList);
    },

    saveSettings: function() {
        if (!this.needsSaving()) return Promise.resolve();

        return this.context.matrixClient.sendStateEvent(
            this.props.roomId,
            'm.room.related_groups',
            {
                groups: this.state.newGroupsList,
            },
            '',
        );
    },

    validateGroupId: function(groupId) {
        if (!GROUP_ID_REGEX.test(groupId)) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Invalid related community ID', '', ErrorDialog, {
                title: _t('Invalid community ID'),
                description: _t('\'%(groupId)s\' is not a valid community ID', { groupId }),
            });
            return false;
        }
        return true;
    },

    onNewGroupChanged: function(newGroupId) {
        this.setState({ newGroupId });
    },

    onGroupAdded: function(groupId) {
        if (groupId.length === 0 || !this.validateGroupId(groupId)) {
            return;
        }
        this.setState({
            newGroupsList: this.state.newGroupsList.concat([groupId]),
            newGroupId: '',
        });
    },

    onGroupEdited: function(groupId, index) {
        if (groupId.length === 0 || !this.validateGroupId(groupId)) {
            return;
        }
        this.setState({
            newGroupsList: Object.assign(this.state.newGroupsList, {[index]: groupId}),
        });
    },

    onGroupDeleted: function(index) {
        const newGroupsList = this.state.newGroupsList.slice();
        newGroupsList.splice(index, 1);
        this.setState({ newGroupsList });
    },

    render: function() {
        const localDomain = this.context.matrixClient.getDomain();
        const EditableItemList = sdk.getComponent('elements.EditableItemList');
        return <div>
            <h3>{ _t('Flair') }</h3>
            <EditableItemList
                items={this.state.newGroupsList}
                className={"mx_RelatedGroupSettings"}
                newItem={this.state.newGroupId}
                canEdit={this.props.canSetRelatedGroups}
                onNewItemChanged={this.onNewGroupChanged}
                onItemAdded={this.onGroupAdded}
                onItemEdited={this.onGroupEdited}
                onItemRemoved={this.onGroupDeleted}
                itemsLabel={_t('Showing flair for these communities:')}
                noItemsLabel={_t('This room is not showing flair for any communities')}
                placeholder={_t(
                    'New community ID (e.g. +foo:%(localDomain)s)', {localDomain},
                )}
            />
        </div>;
    },
});
