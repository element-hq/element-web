/*
 Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import {MatrixClient} from 'matrix-js-sdk';
import sdk from '../../../index';
import Flair from '../elements/Flair.js';
import FlairStore from '../../../stores/FlairStore';
import { _t } from '../../../languageHandler';

export default React.createClass({
    displayName: 'SenderProfile',
    propTypes: {
        mxEvent: PropTypes.object.isRequired, // event whose sender we're showing
        text: PropTypes.string, // Text to show. Defaults to sender name
        onClick: PropTypes.func,
    },

    contextTypes: {
        matrixClient: PropTypes.instanceOf(MatrixClient),
    },

    getInitialState() {
        return {
            userGroups: null,
            relatedGroups: [],
        };
    },

    componentWillMount() {
        this.unmounted = false;
        this._updateRelatedGroups();

        FlairStore.getPublicisedGroupsCached(
            this.context.matrixClient, this.props.mxEvent.getSender(),
        ).then((userGroups) => {
            if (this.unmounted) return;
            this.setState({userGroups});
        });

        this.context.matrixClient.on('RoomState.events', this.onRoomStateEvents);
    },

    componentWillUnmount() {
        this.unmounted = true;
        this.context.matrixClient.removeListener('RoomState.events', this.onRoomStateEvents);
    },

    onRoomStateEvents(event) {
        if (event.getType() === 'm.room.related_groups' &&
            event.getRoomId() === this.props.mxEvent.getRoomId()
        ) {
            this._updateRelatedGroups();
        }
    },

    _updateRelatedGroups() {
        if (this.unmounted) return;
        const room = this.context.matrixClient.getRoom(this.props.mxEvent.getRoomId());
        if (!room) return;

        const relatedGroupsEvent = room.currentState.getStateEvents('m.room.related_groups', '');
        this.setState({
            relatedGroups: relatedGroupsEvent ? relatedGroupsEvent.getContent().groups || [] : [],
        });
    },

    _getDisplayedGroups(userGroups, relatedGroups) {
        let displayedGroups = userGroups || [];
        if (relatedGroups && relatedGroups.length > 0) {
            displayedGroups = displayedGroups.filter((groupId) => {
                return relatedGroups.includes(groupId);
            });
        } else {
            displayedGroups = [];
        }
        return displayedGroups;
    },

    render() {
        const EmojiText = sdk.getComponent('elements.EmojiText');
        const {mxEvent} = this.props;
        const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
        const {msgtype} = mxEvent.getContent();

        if (msgtype === 'm.emote') {
            return <span />; // emote message must include the name so don't duplicate it
        }

        let flair = <div />;
        if (this.props.enableFlair) {
            const displayedGroups = this._getDisplayedGroups(
                this.state.userGroups, this.state.relatedGroups,
            );

            flair = <Flair key='flair'
                userId={mxEvent.getSender()}
                groups={displayedGroups}
            />;
        }

        const nameElem = <EmojiText key='name'>{ name || '' }</EmojiText>;

        // Name + flair
        const nameFlair = <span>
            <span className="mx_SenderProfile_name">
                { nameElem }
            </span>
            { flair }
        </span>;

        const content = this.props.text ?
            <span className="mx_SenderProfile_aux">
                { _t(this.props.text, { senderName: () => nameElem }) }
            </span> : nameFlair;

        return (
            <div className="mx_SenderProfile" dir="auto" onClick={this.props.onClick}>
                { content }
            </div>
        );
    },
});
