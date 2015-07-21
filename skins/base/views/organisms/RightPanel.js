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
var ComponentBroker = require('../../../../src/ComponentBroker');

var MemberList = ComponentBroker.get('organisms/MemberList');

module.exports = React.createClass({
    displayName: 'RightPanel',

    Phase : {
        Blank: 'Blank',
        None: 'None',
        MemberList: 'MemberList',
        FileList: 'FileList',
    },

    getInitialState: function() {
        return {
            phase : this.Phase.None
        }
    },

    onMemberListButtonClick: function() {
        if (this.state.phase == this.Phase.None) {
            this.setState({ phase: this.Phase.MemberList });            
        }
        else {
            this.setState({ phase: this.Phase.None });
        }
    },

    render: function() {
        var buttonGroup;
        var panel;
        if (this.props.roomId) {
            buttonGroup =
                    <div className="mx_RightPanel_headerButtonGroup">
                        <div className="mx_RightPanel_headerButton">
                            <img src="img/file.png" width="32" height="32" alt="Files"/>
                        </div>
                        <div className="mx_RightPanel_headerButton" onClick={ this.onMemberListButtonClick }>
                            <img src="img/members.png" width="32" height="32" alt="Members"/>
                        </div>
                    </div>;

            if (this.state.phase == this.Phase.MemberList) {
                panel = <MemberList roomId={this.props.roomId} key={this.props.roomId} />
            }
        }

        return (
            <div className="mx_RightPanel">
                <div className="mx_RightPanel_header">
                    { buttonGroup }
                </div>
                { panel }
            </div>
        );
    }
});

