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

module.exports = React.createClass({
    displayName: 'RightPanel',

    Phase : {
        MemberList: 'MemberList',
        FileList: 'FileList',
    },

    getInitialState: function() {
        return {
            phase : this.Phase.MemberList
        }
    },

    onMemberListButtonClick: function() {
        if (this.props.collapsed) {
            this.setState({ phase: this.Phase.MemberList });
            dis.dispatch({
                action: 'show_right_panel',
            });
        }
        else {
            dis.dispatch({
                action: 'hide_right_panel',
            });
        }
    },

    render: function() {
        var MemberList = sdk.getComponent('organisms.MemberList');
        var buttonGroup;
        var panel;

        if (this.props.roomId) {
            buttonGroup =
                    <div className="mx_RightPanel_headerButtonGroup">
                        <div className="mx_RightPanel_headerButton mx_RightPanel_filebutton">
                            <img src="img/file.png" width="32" height="32" title="Files" alt="Files"/>
                        </div>
                        <div className="mx_RightPanel_headerButton" onClick={ this.onMemberListButtonClick }>
                            <img src="img/members.png" width="32" height="32" title="Members" alt="Members"/>
                        </div>
                    </div>;

            if (!this.props.collapsed && this.state.phase == this.Phase.MemberList) {
                panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />
            }
        }

        var classes = "mx_RightPanel";
        if (this.props.collapsed) {
            classes += " collapsed";
        }

        return (
            <aside className={classes}>
                <div className="mx_RightPanel_header">
                    { buttonGroup }
                </div>
                { panel }
            </aside>
        );
    }
});

