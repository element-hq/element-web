var MatrixClientPeg = require("../../MatrixClientPeg");

module.exports = {
    getInitialState: function() {
        return {
            room: MatrixClientPeg.get().getRoom(this.props.roomId)
        }
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("Room.timeline", this.onRoomTimeline);
        this.atBottom = true;
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.timeline", this.onRoomTimeline);
        }
    },

    // MatrixRoom still showing the messages from the old room?
    // Set the key to the room_id. Sadly you can no longer get at
    // the key from inside the component, or we'd check this in code.
    /*componentWillReceiveProps: function(props) {
    },*/

    onRoomTimeline: function(ev, room, toStartOfTimeline) {
        if (room.roomId != this.props.roomId) return;
        var messageUl = this.refs.messageList.getDOMNode();
        this.atBottom = messageUl.scrollHeight - messageUl.scrollTop <= messageUl.clientHeight;
        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.roomId)
        });
    },

    componentDidMount: function() {
        var messageUl = this.refs.messageList.getDOMNode();
        messageUl.scrollTop = messageUl.scrollHeight;
    },

    componentDidUpdate: function() {
        if (this.atBottom) {
            var messageUl = this.refs.messageList.getDOMNode();
            messageUl.scrollTop = messageUl.scrollHeight;
        }
    }
};

