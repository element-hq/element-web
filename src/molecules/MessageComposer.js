var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");

module.exports = React.createClass({
    onKeyDown: function (ev) {
        if (ev.keyCode == 13) {
            var contentText = this.refs.textarea.getDOMNode().value;
            MatrixClientPeg.get().sendMessage(this.props.roomId, {
                msgtype: 'm.text',
                body: contentText
            });
            this.refs.textarea.getDOMNode().value = '';
            ev.preventDefault();
        }
    },

    render: function() {
        return (
            <div className="mx_MessageComposer">
                <textarea ref="textarea" onKeyDown={this.onKeyDown} />
            </div>
        );
    },
});

