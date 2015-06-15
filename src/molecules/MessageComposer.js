var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");

module.exports = React.createClass({
    render: function() {
        return (
            <div className="mx_MessageComposer">
                <form>
                    <textarea />
                </form>
            </div>
        );
    },
});

