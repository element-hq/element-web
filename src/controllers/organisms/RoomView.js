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
        // no point handling anything while we're waiting for the join to finish:
        // we'll only be showing a spinner.
        if (this.state.joining) return;
        if (room.roomId != this.props.roomId) return;
        
        if (this.refs.messageList) {
            var messageUl = this.refs.messageList.getDOMNode();
            this.atBottom = messageUl.scrollHeight - messageUl.scrollTop <= messageUl.clientHeight;
        }
        this.setState({
            room: MatrixClientPeg.get().getRoom(this.props.roomId)
        });
    },

    componentDidMount: function() {
        if (this.refs.messageList) {
            var messageUl = this.refs.messageList.getDOMNode();
            messageUl.scrollTop = messageUl.scrollHeight;
        }
    },

    componentDidUpdate: function() {
        if (this.refs.messageList && this.atBottom) {
            var messageUl = this.refs.messageList.getDOMNode();
            messageUl.scrollTop = messageUl.scrollHeight;
        }
    },

    onJoinButtonClicked: function(ev) {
        var that = this;
        MatrixClientPeg.get().joinRoom(this.props.roomId).then(function() {
            that.setState({
                joining: false,
                room: MatrixClientPeg.get().getRoom(that.props.roomId)
            });
        }, function(error) {
            that.setState({
                joining: false,
                joinError: error
            });
        });
        this.setState({
            joining: true
        });
    }
};

