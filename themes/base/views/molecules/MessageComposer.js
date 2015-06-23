var React = require('react');

var MessageComposerController = require("../../../../src/controllers/molecules/MessageComposer");

module.exports = React.createClass({
    displayName: 'MessageComposer',
    mixins: [MessageComposerController],

    render: function() {
        return (
            <div className="mx_MessageComposer">
                <textarea ref="textarea" onKeyDown={this.onKeyDown} />
            </div>
        );
    },
});

