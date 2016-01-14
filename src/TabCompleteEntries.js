/*
Copyright 2015, 2016 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var React = require("react");
var sdk = require("./index");

class Entry {
    constructor(text) {
        this.text = text;
    }

    /**
     * @return {string} The text to display in this entry.
     */
    getText() {
        return this.text;
    }

    /**
     * @return {string} The text to insert into the input box. Most of the time
     * this is the same as getText().
     */
    getFillText() {
        return this.text;
    }

    /**
     * @return {ReactClass} Raw JSX
     */
    getImageJsx() {
        return null;
    }

    /**
     * @return {?string} The unique key= prop for React dedupe
     */
    getKey() {
        return null;
    }

    /**
     * @return {?string} The suffix to append to the tab-complete, or null to
     * not do this.
     */
    getSuffix(isFirstWord) {
        return null;
    }

    /**
     * Called when this entry is clicked.
     */
    onClick() {
        // NOP
    }
}

class CommandEntry extends Entry {
    constructor(cmd, cmdWithArgs) {
        super(cmdWithArgs);
        this.cmd = cmd;
    }

    getFillText() {
        return this.cmd;
    }

    getKey() {
        return this.getFillText();
    }

    getSuffix(isFirstWord) {
        return " "; // force a space after the command.
    }
}

CommandEntry.fromCommands = function(commandArray) {
    return commandArray.map(function(cmd) {
        return new CommandEntry(cmd.getCommand(), cmd.getCommandWithArgs());
    });
}

class MemberEntry extends Entry {
    constructor(member) {
        super(member.name || member.userId);
        this.member = member;
    }

    getImageJsx() {
        var MemberAvatar = sdk.getComponent("views.avatars.MemberAvatar");
        return (
            <MemberAvatar member={this.member} width={24} height={24} />
        );
    }

    getKey() {
        return this.member.userId;
    }

    getSuffix(isFirstWord) {
        return isFirstWord ? ": " : " ";
    }
}

MemberEntry.fromMemberList = function(members) {
    return members.sort(function(a, b) {
        var userA = a.user;
        var userB = b.user;
        if (userA && !userB) {
            return -1; // a comes first
        }
        else if (!userA && userB) {
            return 1; // b comes first
        }
        else if (!userA && !userB) {
            return 0; // don't care
        }
        else { // both User objects exist
            if (userA.lastActiveAgo < userB.lastActiveAgo) {
                return -1; // a comes first
            }
            else if (userA.lastActiveAgo > userB.lastActiveAgo) {
                return 1; // b comes first
            }
            else {
                return 0; // same last active ago
            }
        }
    }).map(function(m) {
        return new MemberEntry(m);
    });
}

module.exports.Entry = Entry;
module.exports.MemberEntry = MemberEntry;
module.exports.CommandEntry = CommandEntry;
