var MatrixClientPeg = require('./MatrixClientPeg');

module.exports = {
    /**
     * Given a room object, return the canonical alias for it
     * if there is one. Otherwise return null;
     */
    getCanonicalAliasForRoom: function(room) {
        var aliasEvents = room.currentState.getStateEvents(
            "m.room.aliases"
        );
        // Canonical aliases aren't implemented yet, so just return the first
        for (var j = 0; j < aliasEvents.length; j++) {
            var aliases = aliasEvents[j].getContent().aliases;
            if (aliases && aliases.length) {
                return aliases[0];
            }
        }
        return null;
    }
}

