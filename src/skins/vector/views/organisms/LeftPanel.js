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

module.exports = React.createClass({
    displayName: 'LeftPanel',

    getInitialState: function() {
        return {
            collapsed: false,
        };
    },

    onShowClick: function() {
        this.setState({ collapsed : false });
    },

    onHideClick: function() {
        this.setState({ collapsed : true });
    },

    render: function() {
        var RoomList = sdk.getComponent('organisms.RoomList');
        var BottomLeftMenu = sdk.getComponent('molecules.BottomLeftMenu');
        var IncomingCallBox = sdk.getComponent('molecules.voip.IncomingCallBox');

        var collapseButton;
        var classes = "mx_LeftPanel";
        if (this.state.collapsed) {
            classes += " collapsed";
            collapseButton = <img className="mx_LeftPanel_showButton" onClick={ this.onShowClick } src="img/menu.png" width="27" height="20" alt=">"/>
        }
        else {
            collapseButton = <img className="mx_LeftPanel_hideButton" onClick={ this.onHideClick } src="img/hide.png" width="12" height="20" alt="<"/>   
        }

        return (
            <aside className={classes}>
                { collapseButton }
                <IncomingCallBox />
                <RoomList selectedRoom={this.props.selectedRoom} collapsed={this.state.collapsed}/>
                <BottomLeftMenu />
            </aside>
        );
    }
});

