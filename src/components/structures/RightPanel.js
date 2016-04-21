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

var React = require('react');
var sdk = require('matrix-react-sdk')
var dis = require('matrix-react-sdk/lib/dispatcher');
var MatrixClientPeg = require("matrix-react-sdk/lib/MatrixClientPeg");
var rate_limited_func = require('matrix-react-sdk/lib/ratelimitedfunc');

module.exports = React.createClass({
    displayName: 'RightPanel',

    Phase : {
        MemberList: 'MemberList',
        FileList: 'FileList',
        MemberInfo: 'MemberInfo',
    },

    componentWillMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
        }
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

    onRoomStateMember: function(ev, state, member) {
        // redraw the badge on the membership list
        if (this.state.phase == this.Phase.MemberList && member.roomId === this.props.roomId) {
            this._delayedUpdate();
        }
        else if (this.state.phase === this.Phase.MemberInfo && member.roomId === this.props.roomId &&
                member.userId === this.state.member.userId) {
            // refresh the member info (e.g. new power level)
            this._delayedUpdate();
        }
    },

    _delayedUpdate: new rate_limited_func(function() {
        this.forceUpdate();
    }, 500),

    onAction: function(payload) {
        if (payload.action === "view_user") {
            dis.dispatch({
                action: 'show_right_panel',
            });
            if (payload.member) {
                this.setState({
                    phase: this.Phase.MemberInfo,
                    member: payload.member,
                });
            }
            else {
                this.setState({
                    phase: this.Phase.MemberList
                });
            }
        }
        if (payload.action === "view_room") {
            if (this.state.phase === this.Phase.MemberInfo) {
                this.setState({
                    phase: this.Phase.MemberList
                });
            }
        }
    },

    render: function() {
        var MemberList = sdk.getComponent('rooms.MemberList');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var buttonGroup;
        var panel;

        var filesHighlight;
        var membersHighlight;
        if (!this.props.collapsed) {
            if (this.state.phase == this.Phase.MemberList || this.state.phase === this.Phase.MemberInfo) {
                membersHighlight = <div className="mx_RightPanel_headerButton_highlight"></div>;
            }
            else if (this.state.phase == this.Phase.FileList) {
                filesHighlight = <div className="mx_RightPanel_headerButton_highlight"></div>;
            }
        }

        var membersBadge;
        if ((this.state.phase == this.Phase.MemberList || this.state.phase === this.Phase.MemberInfo) && this.props.roomId) {
            var cli = MatrixClientPeg.get();
            var room = cli.getRoom(this.props.roomId);
            if (room) {
                membersBadge = <div className="mx_RightPanel_headerButton_badge">{ room.getJoinedMembers().length }</div>;
            }
        }

        if (this.props.roomId) {
            buttonGroup =
                    <div className="mx_RightPanel_headerButtonGroup">
                        <div className="mx_RightPanel_headerButton" title="Members" onClick={ this.onMemberListButtonClick }>
                            <TintableSvg src="img/members.svg" width="17" height="22"/>
                            { membersBadge }
                            { membersHighlight }
                        </div>
                        <div className="mx_RightPanel_headerButton mx_RightPanel_filebutton" title="Files">
                            <TintableSvg src="img/files.svg" width="17" height="22"/>
                            { filesHighlight }
                        </div>
                    </div>;

            if (!this.props.collapsed) {
                if(this.state.phase == this.Phase.MemberList) {
                    panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />
                }
                else if(this.state.phase == this.Phase.MemberInfo) {
                    var MemberInfo = sdk.getComponent('rooms.MemberInfo');
                    panel = <MemberInfo roomId={this.props.roomId} member={this.state.member} key={this.props.roomId} />
                }
            }
        }

        if (!panel) {
            panel = <div className="mx_RightPanel_blank"></div>;
        }

        var classes = "mx_RightPanel mx_fadable";
        if (this.props.collapsed) {
            classes += " collapsed";
        }

        return (
            <aside className={classes} style={{ opacity: this.props.opacity }}>
                <div className="mx_RightPanel_header">
                    { buttonGroup }
                </div>
                { panel }
                <div className="mx_RightPanel_footer">
                </div>
            </aside>
        );
    }
});

