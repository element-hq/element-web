var React = require('react');
var Message = require('../molecules/Message');

module.exports = React.createClass({
    getInitialState: function() {
        return {
            messages: [ { foo: "bar"} ]
        }
    },

    render: function() {
        var messageItems = this.state.messages.map(function(ev) {
            return (
                <Message ev={ev} />
            );
        });
        return (
            <div>
                <ul className="message-list" ref="messageList">
                    {messageItems}
                </ul>
            </div>
        );
    },
});

