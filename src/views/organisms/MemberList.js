var React = require('react');

var MemberListController = require("../../controllers/organisms/MemberList");

var ComponentBroker = require('../../ComponentBroker');

var MemberTile = ComponentBroker.get("molecules/MemberTile");


module.exports = React.createClass({
    displayName: 'MemberList',
    mixins: [MemberListController],

    makeMemberTiles: function() {
        var that = this;
        return Object.keys(that.state.memberDict).map(function(userId) {
            var m = that.state.memberDict[userId];
            return (
                <li key={userId}>
                <MemberTile
                    member={m}
                />
                </li>
            );
        });
    },

    render: function() {
        return (
            <div className="mx_MemberList">
                <ul>
                    {this.makeMemberTiles()}
                </ul>
            </div>
        );
    }
});

