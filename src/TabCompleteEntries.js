/*
Copyright 2015 OpenMarket Ltd

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
}

module.exports.Entry = Entry;
module.exports.MemberEntry = MemberEntry;
