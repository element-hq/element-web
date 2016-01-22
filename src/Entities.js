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

var React = require('react');
var sdk = require('./index');

function isMatch(query, name, uid) {
    query = query.toLowerCase();
    name = name.toLowerCase();
    uid = uid.toLowerCase();

    // direct prefix matches
    if (name.indexOf(query) === 0 || uid.indexOf(query) === 0) {
        return true;
    }

    // strip @ on uid and try matching again
    if (uid.length > 1 && uid[0] === "@" && uid.substring(1).indexOf(query) === 0) {
        return true;
    }

    // split spaces in name and try matching constituent parts
    var parts = name.split(" ");
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].indexOf(query) === 0) {
            return true;
        }
    }
    return false;
}

/*
 * Converts various data models to Entity objects.
 *
 * Entity objects provide an interface for UI components to use to display
 * members in a data-agnostic way. This means they don't need to care if the
 * underlying data model is a RoomMember, User or 3PID data structure, it just
 * cares about rendering.
 */

class Entity {
    constructor(model) {
        this.model = model;
    }

    getJsx() {
        return null;
    }

    matches(queryString) {
        return false;
    }
}

class MemberEntity extends Entity {
    getJsx() {
        var MemberTile = sdk.getComponent("rooms.MemberTile");
        return (
            <MemberTile key={this.model.userId} member={this.model} />
        );
    }

    matches(queryString) {
        return isMatch(queryString, this.model.name, this.model.userId);
    }
}

class UserEntity extends Entity {

    constructor(model, showInviteButton, inviteFn) {
        super(model);
        this.showInviteButton = Boolean(showInviteButton);
        this.inviteFn = inviteFn;
    }

    onClick() {
        if (this.inviteFn) {
            this.inviteFn(this.model.userId);
        }
    }

    getJsx() {
        var UserTile = sdk.getComponent("rooms.UserTile");
        return (
            <UserTile key={this.model.userId} user={this.model}
                showInviteButton={this.showInviteButton} onClick={this.onClick.bind(this)} />
        );
    }

    matches(queryString) {
        var name = this.model.displayName || this.model.userId;
        return isMatch(queryString, name, this.model.userId);
    }
}


module.exports = {
    newEntity: function(jsx, matchFn) {
        var entity = new Entity();
        entity.getJsx = function() {
            return jsx;
        };
        entity.matches = matchFn;
        return entity;
    },

    /**
     * @param {RoomMember[]} members
     * @return {Entity[]}
     */
    fromRoomMembers: function(members) {
        return members.map(function(m) {
            return new MemberEntity(m);
        });
    },

    /**
     * @param {User[]} users
     * @param {boolean} showInviteButton
     * @param {Function} inviteFn Called with the user ID.
     * @return {Entity[]}
     */
    fromUsers: function(users, showInviteButton, inviteFn) {
        return users.map(function(u) {
            return new UserEntity(u, showInviteButton, inviteFn);
        })
    }
};
