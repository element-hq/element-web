/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { User, UserEvent } from "../../src/models/user";
import { mkEvent } from "../test-utils/test-utils";

describe("User", function () {
    const userId = "@alice:bar";
    let user: User;

    beforeEach(function () {
        user = new User(userId);
    });

    describe("setPresenceEvent", function () {
        const event = mkEvent({
            type: "m.presence",
            content: {
                presence: "online",
                user_id: userId,
                displayname: "Alice",
                last_active_ago: 1085,
                avatar_url: "mxc://foo/bar",
            },
            event: true,
        });

        it("should emit 'User.displayName' if the display name changes", function () {
            let emitCount = 0;
            user.on(UserEvent.DisplayName, function (ev, usr) {
                emitCount += 1;
            });
            user.setPresenceEvent(event);
            expect(emitCount).toEqual(1);
            user.setPresenceEvent(event); // no-op
            expect(emitCount).toEqual(1);
        });

        it("should emit 'User.avatarUrl' if the avatar URL changes", function () {
            let emitCount = 0;
            user.on(UserEvent.AvatarUrl, function (ev, usr) {
                emitCount += 1;
            });
            user.setPresenceEvent(event);
            expect(emitCount).toEqual(1);
            user.setPresenceEvent(event); // no-op
            expect(emitCount).toEqual(1);
        });

        it("should emit 'User.presence' if the presence changes", function () {
            let emitCount = 0;
            user.on(UserEvent.Presence, function (ev, usr) {
                emitCount += 1;
            });
            user.setPresenceEvent(event);
            expect(emitCount).toEqual(1);
            user.setPresenceEvent(event); // no-op
            expect(emitCount).toEqual(1);
        });

        it("should set User.displayName", function () {
            user.setPresenceEvent(event);
            expect(user.displayName).toEqual("Alice");
        });

        it("should set User.avatarUrl", function () {
            user.setPresenceEvent(event);
            expect(user.avatarUrl).toEqual("mxc://foo/bar");
        });

        it("should set User.presence", function () {
            user.setPresenceEvent(event);
            expect(user.presence).toEqual("online");
        });

        it("should set User.lastActiveAgo", function () {
            user.setPresenceEvent(event);
            expect(user.lastActiveAgo).toEqual(1085);
        });

        it("should set User.events.presence", function () {
            user.setPresenceEvent(event);
            expect(user.events.presence).toEqual(event);
        });
    });
});
