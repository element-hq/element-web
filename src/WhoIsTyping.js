var MatrixClientPeg = require("./MatrixClientPeg");

module.exports = {
    usersTypingApartFromMe: function(room) {
        return this.usersTyping(
            room, [MatrixClientPeg.get().credentials.userId]
        );
    },

    /**
     * Given a Room object and, optionally, a list of userID strings
     * to exclude, return a list of user objects who are typing.
     */
    usersTyping: function(room, exclude) {
        var whoIsTyping = [];

        if (exclude === undefined) {
            exclude = [];
        }

        var memberKeys = Object.keys(room.currentState.members);
        for (var i = 0; i < memberKeys.length; ++i) {
            var userId = memberKeys[i];

            if (room.currentState.members[userId].typing) {
                if (exclude.indexOf(userId) == -1) {
                    whoIsTyping.push(room.currentState.members[userId]);
                }
            }
        }

        return whoIsTyping;
    },

    whoIsTypingString: function(room) {
        var whoIsTyping = this.usersTypingApartFromMe(room);
        if (whoIsTyping.length == 0) {
            return null;
        } else if (whoIsTyping.length == 1) {
            return whoIsTyping[0].name + ' is typing';
        } else {
            var names = whoIsTyping.map(function(m) {
                return m.name;
            });
            var lastPerson = names.shift();
            return names.join(', ') + ' and ' + lastPerson + ' are typing';
        }
    }
};
