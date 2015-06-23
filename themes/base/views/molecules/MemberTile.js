var React = require('react');

var MemberTileController = require("../../../../src/controllers/molecules/MemberTile");

module.exports = React.createClass({
    displayName: 'MemberTile',
    mixins: [MemberTileController],
    render: function() {
        return (
            <div className="mx_MemberTile">
                <div className="mx_MemberTile_name">{this.props.member.name}</div>
            </div>
        );
    }
});
