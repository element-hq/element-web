var React = require('react');

var MessageComposerController = require("../../controllers/molecules/MessageComposer");

module.exports = React.createClass({
    mixins: [MessageComposerController],

    render: function() {
        return (
            <div className="mx_MessageComposer">
                <textarea ref="textarea" onKeyDown={this.onKeyDown} />
            </div>
        );
    },
});

