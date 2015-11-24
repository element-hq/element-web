var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var dis = require('matrix-react-sdk/lib/dispatcher');

module.exports = {
    resend: function(event) {
        MatrixClientPeg.get().resendEvent(
            event, MatrixClientPeg.get().getRoom(event.getRoomId())
        ).done(function() {
            dis.dispatch({
                action: 'message_sent',
                event: event
            });
        }, function() {
            dis.dispatch({
                action: 'message_send_failed',
                event: event
            });
        });
        dis.dispatch({
            action: 'message_resend_started',
            event: event
        });
    },
};