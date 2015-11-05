/*
Copyright 2015 OpenMarket Ltd

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

var React = require('react');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');

var RoomListController = require('../../../../controllers/organisms/RoomList')

module.exports = React.createClass({
    displayName: 'RoomList',
    mixins: [RoomListController],

    onShowClick: function() {
        dis.dispatch({
            action: 'show_left_panel',
        });
    },

    render: function() {
        var expandButton = this.props.collapsed ? 
                           <img className="mx_RoomList_expandButton" onClick={ this.onShowClick } src="img/menu.png" width="20" alt=">"/> :
                           null;

        var RoomSubList = sdk.getComponent('organisms.RoomSubList');

        return (
            <div className="mx_RoomList" onScroll={this._repositionTooltip}>
                { expandButton }

                <RoomSubList list={ this.state.lists['invites'] }
                             label="Invites"
                             editable={ false }
                             order="recent"
                             activityMap={ this.state.activityMap }
                             selectedRoom={ this.props.selectedRoom }
                             collapsed={ this.props.collapsed } />

                <RoomSubList list={ this.state.lists['favourites'] }
                             label="Favourites"
                             tagname="favourites"
                             verb="favourite"
                             editable={ true }
                             order="manual"
                             activityMap={ this.state.activityMap }
                             selectedRoom={ this.props.selectedRoom }
                             collapsed={ this.props.collapsed } />

                <RoomSubList list={ this.state.lists['recents'] }
                             label="Recents"
                             editable={ true }
                             order="recent"
                             activityMap={ this.state.activityMap }
                             selectedRoom={ this.props.selectedRoom }
                             collapsed={ this.props.collapsed } />

                <RoomSubList list={ this.state.lists['hidden'] }
                             label="Hidden"
                             tagname="hidden"
                             verb="hide"
                             editable={ true }
                             order="recent"
                             activityMap={ this.state.activityMap }
                             selectedRoom={ this.props.selectedRoom }
                             collapsed={ this.props.collapsed } />

                <RoomSubList list={ this.state.lists['archived'] }
                             label="Historical"
                             editable={ false }
                             order="recent"
                             activityMap={ this.state.activityMap }
                             selectedRoom={ this.props.selectedRoom }
                             collapsed={ this.props.collapsed } />
            </div>
        );
    }
});

