
function textForMemberEvent(ev) {
    // XXX: SYJS-16
    var senderName = ev.sender ? ev.sender.name : ev.getSender();
    var targetName = ev.target ? ev.target.name : ev.getContent().target;
    switch (ev.getContent().membership) {
        case 'invite':
            return senderName + " invited " + targetName + ".";
        case 'join':
            if (ev.getPrevContent() && ev.getPrevContent().membership == 'join') {
                if (ev.getPrevContent().displayname && ev.getContent().displayname) {
                    return ev.getSender() + " changed their display name from " +
                        ev.getPrevContent().displayname + " to " +
                        ev.getContent().displayname;
                } else if (!ev.getPrevContent().displayname && ev.getContent().displayname) {
                    return ev.getSender() + " set their display name to " + ev.getContent().displayname;
                } else if (ev.getPrevContent().displayname && !ev.getContent().displayname) {
                    return ev.getSender() + " removed their display name";
                }
            } else {
                return targetName + " joined the room.";
            }
        case 'leave':
            return targetName + " left the room.";
    }
};

var handlers = {
    'm.room.member': textForMemberEvent
};

module.exports = {
    textForEvent(ev) {
        var hdlr = handlers[ev.getType()];
        if (!hdlr) return "Unknown entry event";
        return hdlr(ev);
    }
}
