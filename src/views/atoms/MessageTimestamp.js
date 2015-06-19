var React = require('react');

var MessageTimestampController = require("../../controllers/atoms/MessageTimestamp");

module.exports = React.createClass({
    displayName: 'MessageTimestamp',
    mixins: [MessageTimestampController],

    render: function() {
        var date = new Date(this.props.ts);
        return (
            <span className="mx_MessageTimestamp">
                {date.toLocaleTimeString()}
            </span>
        );
    },
});

