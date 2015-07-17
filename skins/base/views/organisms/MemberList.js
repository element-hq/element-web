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

var MemberListController = require("../../../../src/controllers/organisms/MemberList");

var ComponentBroker = require('../../../../src/ComponentBroker');

var MemberTile = ComponentBroker.get("molecules/MemberTile");


module.exports = React.createClass({
    displayName: 'MemberList',
    mixins: [MemberListController],

    makeMemberTiles: function() {
        var that = this;
        return Object.keys(that.state.memberDict).map(function(userId) {
            var m = that.state.memberDict[userId];
            return (
                <MemberTile key={userId} member={m} />
            );
        });
    },

    render: function() {
        return (
            <div className="mx_MemberList">
                <div className="mx_MemberList_chevron">
                    <img src="img/chevron.png" width="24" height="13"/>
                </div>
                <div className="mx_MemberList_border">
                    <h2>Members</h2>
                    <div className="mx_MemberList_wrapper">
                        {this.makeMemberTiles()}
                        <div className="mx_MemberTile">
                            <div className="mx_MemberTile_avatar"><img src="img/create-big.png" width="40" height="40" alt=""/></div>            
                            <div className="mx_MemberTile_name">Invite</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

