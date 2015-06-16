var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");

module.exports = React.createClass({
    onKeyDown: function (ev) {
        if (ev.keyCode == 13) {
            var contentText = this.refs.textarea.getDOMNode().value;

            var content = null;
            if (/^\/me /i.test(contentText)) {
                content = {
                    msgtype: 'm.emote',
                    body: contentText.substring(4)
                };
            } else {
                content = {
                    msgtype: 'm.text',
                    body: contentText
                };
            }

            MatrixClientPeg.get().sendMessage(this.props.roomId, content);
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

