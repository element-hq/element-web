var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg");

var dis = require("../dispatcher");

module.exports = React.createClass({
    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'focus_composer':
                this.refs.textarea.getDOMNode().focus();
                break;
        }
    },

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

