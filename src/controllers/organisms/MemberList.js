var React = require("react");
var MatrixClientPeg = require("../../MatrixClientPeg");

module.exports = {
    componentWillMount: function() {
        var cli = MatrixClientPeg.get();
        cli.on("RoomState.members", this.onRoomStateMember);

        this.setState({
            memberDict: cli.getRoom(this.props.roomId).currentState.members
        });
    },

    componentWillUnmount: function() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.members", this.onRoomStateMember);
        }
    },

    // Remember to set 'key' on a MemberList to the ID of the room it's for
    /*componentWillReceiveProps: function(newProps) {
    },*/

    onRoomStateMember: function(ev, state, member) {
        this.setState({
            memberDict: cli.getRoom(this.props.roomId).currentState.members
        });
    }
};

