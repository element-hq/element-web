var MatrixClientPeg = require('./MatrixClientPeg');
var dis = require('./dispatcher');

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

    removeFromQueue: function(event) {
        MatrixClientPeg.get().getScheduler().removeEventFromQueue(event);
        var room = MatrixClientPeg.get().getRoom(event.getRoomId());
        if (!room) {
            return;
        }
        room.removeEvents([event.getId()]);
    }
};