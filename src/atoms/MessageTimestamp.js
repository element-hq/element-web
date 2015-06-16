var React = require('react');

module.exports = React.createClass({
    render: function() {
        var date = new Date(this.props.ts);
        return (
            <span className="mx_MessageTimestamp">
                {date.toLocaleTimeString()}
            </span>
        );
    },
});

