var React = require('react');

module.exports = React.createClass({
    render: function() {
        var member = this.props.memberName;
        return (
            <span className="mx_SenderProfile">
                {member}
            </span>
        );
    },
});

