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

    render: function() {
        return (
            <div className="mx_RightPanel">
                <div className="mx_RightPanel_header">
                    <div className="mx_RightPanel_headerButtonGroup">
                        <div className="mx_RightPanel_headerButton">
                            <img src="img/file.png" width="32" height="32" alt="Files"/>
                        </div>
                        <div className="mx_RightPanel_headerButton">
                            <img src="img/members.png" width="32" height="32" alt="Members"/>
                        </div>
                    </div>
                </div>
                <MemberList roomId={this.props.roomId} key={this.props.roomId} />
            </div>
        );
    }
});

