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

    whoIsTypingString: function(room, limit) {
        const whoIsTyping = this.usersTypingApartFromMe(room);
        const othersCount = limit === undefined ? 0 : Math.max(whoIsTyping.length - limit, 0);
        if (whoIsTyping.length == 0) {
            return '';
        } else if (whoIsTyping.length == 1) {
            return whoIsTyping[0].name + ' is typing';
        }
        const names = whoIsTyping.map(function(m) {
            return m.name;
        });
        if (othersCount) {
            const other = ' other' + (othersCount > 1 ? 's' : '');
            return names.slice(0, limit).join(', ') + ' and ' + othersCount + other + ' are typing';
        } else {
            const lastPerson = names.pop();
            return names.join(', ') + ' and ' + lastPerson + ' are typing';
        }
    }
};
