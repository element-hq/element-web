import React from 'react';
import ReactTestUtils from 'react-dom/test-utils';
import ReactDOM from 'react-dom';

import * as TestUtils from '../../../test-utils';

import {MatrixClientPeg} from '../../../../src/MatrixClientPeg';
import sdk from '../../../skinned-sdk';

import {Room, RoomMember, User} from 'matrix-js-sdk';

function generateRoomId() {
    return '!' + Math.random().toString().slice(2, 10) + ':domain';
}


describe('MemberList', () => {
    function createRoom(opts) {
        const room = new Room(generateRoomId(), null, client.getUserId());
        if (opts) {
            Object.assign(room, opts);
        }
        return room;
    }

    let parentDiv = null;
    let client = null;
    let root = null;
    let memberListRoom;
    let memberList = null;

    let adminUsers = [];
    let moderatorUsers = [];
    let defaultUsers = [];

    beforeEach(function() {
        TestUtils.stubClient();
        client = MatrixClientPeg.get();
        client.hasLazyLoadMembersEnabled = () => false;

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);

        // Make room
        memberListRoom = createRoom();
        expect(memberListRoom.roomId).toBeTruthy();

        // Make users
        adminUsers = [];
        moderatorUsers = [];
        defaultUsers = [];
        const usersPerLevel = 2;
        for (let i = 0; i < usersPerLevel; i++) {
            const adminUser = new RoomMember(memberListRoom.roomId, `@admin${i}:localhost`);
            adminUser.membership = "join";
            adminUser.powerLevel = 100;
            adminUser.user = new User(adminUser.userId);
            adminUser.user.currentlyActive = true;
            adminUser.user.presence = 'online';
            adminUser.user.lastPresenceTs = 1000;
            adminUser.user.lastActiveAgo = 10;
            adminUsers.push(adminUser);

            const moderatorUser = new RoomMember(memberListRoom.roomId, `@moderator${i}:localhost`);
            moderatorUser.membership = "join";
            moderatorUser.powerLevel = 50;
            moderatorUser.user = new User(moderatorUser.userId);
            moderatorUser.user.currentlyActive = true;
            moderatorUser.user.presence = 'online';
            moderatorUser.user.lastPresenceTs = 1000;
            moderatorUser.user.lastActiveAgo = 10;
            moderatorUsers.push(moderatorUser);

            const defaultUser = new RoomMember(memberListRoom.roomId, `@default${i}:localhost`);
            defaultUser.membership = "join";
            defaultUser.powerLevel = 0;
            defaultUser.user = new User(defaultUser.userId);
            defaultUser.user.currentlyActive = true;
            defaultUser.user.presence = 'online';
            defaultUser.user.lastPresenceTs = 1000;
            defaultUser.user.lastActiveAgo = 10;
            defaultUsers.push(defaultUser);
        }

        client.getRoom = (roomId) => {
            if (roomId === memberListRoom.roomId) return memberListRoom;
            else return null;
        };
        memberListRoom.currentState = {
            members: {},
            getStateEvents: () => [], // ignore 3pid invites
        };
        for (const member of [...adminUsers, ...moderatorUsers, ...defaultUsers]) {
            memberListRoom.currentState.members[member.userId] = member;
        }

        const MemberList = sdk.getComponent('views.rooms.MemberList');
        const WrappedMemberList = TestUtils.wrapInMatrixClientContext(MemberList);
        const gatherWrappedRef = (r) => {
            memberList = r;
        };
        root = ReactDOM.render(<WrappedMemberList roomId={memberListRoom.roomId}
                                                  wrappedRef={gatherWrappedRef} />, parentDiv);
    });

    afterEach((done) => {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }

        done();
    });

    function expectOrderedByPresenceAndPowerLevel(memberTiles, isPresenceEnabled) {
        let prevMember = null;
        for (const tile of memberTiles) {
            const memberA = prevMember;
            const memberB = tile.props.member;
            prevMember = memberB; // just in case an expect fails, set this early
            if (!memberA) {
                continue;
            }

            console.log("COMPARING A VS B:");
            console.log(memberList.memberString(memberA));
            console.log(memberList.memberString(memberB));

            const userA = memberA.user;
            const userB = memberB.user;

            let groupChange = false;

            if (isPresenceEnabled) {
                const convertPresence = (p) => p === 'unavailable' ? 'online' : p;
                const presenceIndex = p => {
                    const order = ['active', 'online', 'offline'];
                    const idx = order.indexOf(convertPresence(p));
                    return idx === -1 ? order.length : idx; // unknown states at the end
                };

                const idxA = presenceIndex(userA.currentlyActive ? 'active' : userA.presence);
                const idxB = presenceIndex(userB.currentlyActive ? 'active' : userB.presence);
                console.log("Comparing presence groups...");
                expect(idxB).toBeGreaterThanOrEqual(idxA);
                groupChange = idxA !== idxB;
            } else {
                console.log("Skipped presence groups");
            }

            if (!groupChange) {
                console.log("Comparing power levels...");
                expect(memberA.powerLevel).toBeGreaterThanOrEqual(memberB.powerLevel);
                groupChange = memberA.powerLevel !== memberB.powerLevel;
            } else {
                console.log("Skipping power level check due to group change");
            }

            if (!groupChange) {
                if (isPresenceEnabled) {
                    console.log("Comparing last active timestamp...");
                    expect(userB.getLastActiveTs()).toBeLessThanOrEqual(userA.getLastActiveTs());
                    groupChange = userA.getLastActiveTs() !== userB.getLastActiveTs();
                } else {
                    console.log("Skipping last active timestamp");
                }
            } else {
                console.log("Skipping last active timestamp check due to group change");
            }

            if (!groupChange) {
                const nameA = memberA.name[0] === '@' ? memberA.name.substr(1) : memberA.name;
                const nameB = memberB.name[0] === '@' ? memberB.name.substr(1) : memberB.name;
                const nameCompare = nameB.localeCompare(nameA);
                console.log("Comparing name");
                expect(nameCompare).toBeGreaterThanOrEqual(0);
            } else {
                console.log("Skipping name check due to group change");
            }
        }
    }

    function itDoesOrderMembersCorrectly(enablePresence) {
        const MemberTile = sdk.getComponent("rooms.MemberTile");
        describe('does order members correctly', () => {
            // Note: even if presence is disabled, we still expect that the presence
            // tests will pass. All expectOrderedByPresenceAndPowerLevel does is ensure
            // the order is perceived correctly, regardless of what we did to the members.

            // Each of the 4 tests here is done to prove that the member list can meet
            // all 4 criteria independently. Together, they should work.

            it('by presence state', () => {
                // Intentionally pick users that will confuse the power level sorting
                const activeUsers = [defaultUsers[0]];
                const onlineUsers = [adminUsers[0]];
                const offlineUsers = [...moderatorUsers, ...adminUsers.slice(1), ...defaultUsers.slice(1)];
                activeUsers.forEach((u) => {
                    u.user.currentlyActive = true;
                    u.user.presence = 'online';
                });
                onlineUsers.forEach((u) => {
                    u.user.currentlyActive = false;
                    u.user.presence = 'online';
                });
                offlineUsers.forEach((u) => {
                    u.user.currentlyActive = false;
                    u.user.presence = 'offline';
                });

                // Bypass all the event listeners and skip to the good part
                memberList._showPresence = enablePresence;
                memberList._updateListNow();

                const tiles = ReactTestUtils.scryRenderedComponentsWithType(root, MemberTile);
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it('by power level', () => {
                // We already have admin, moderator, and default users so leave them alone

                // Bypass all the event listeners and skip to the good part
                memberList._showPresence = enablePresence;
                memberList._updateListNow();

                const tiles = ReactTestUtils.scryRenderedComponentsWithType(root, MemberTile);
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it('by last active timestamp', () => {
                // Intentionally pick users that will confuse the power level sorting
                // lastActiveAgoTs == lastPresenceTs - lastActiveAgo
                const activeUsers = [defaultUsers[0]];
                const semiActiveUsers = [adminUsers[0]];
                const inactiveUsers = [...moderatorUsers, ...adminUsers.slice(1), ...defaultUsers.slice(1)];
                activeUsers.forEach((u) => {
                    u.powerLevel = 100; // set everyone to the same PL to avoid running that check
                    u.user.lastPresenceTs = 1000;
                    u.user.lastActiveAgo = 0;
                });
                semiActiveUsers.forEach((u) => {
                    u.powerLevel = 100;
                    u.user.lastPresenceTs = 1000;
                    u.user.lastActiveAgo = 50;
                });
                inactiveUsers.forEach((u) => {
                    u.powerLevel = 100;
                    u.user.lastPresenceTs = 1000;
                    u.user.lastActiveAgo = 100;
                });

                // Bypass all the event listeners and skip to the good part
                memberList._showPresence = enablePresence;
                memberList._updateListNow();

                const tiles = ReactTestUtils.scryRenderedComponentsWithType(root, MemberTile);
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it('by name', () => {
                // Intentionally put everyone on the same level to force a name comparison
                const allUsers = [...adminUsers, ...moderatorUsers, ...defaultUsers];
                allUsers.forEach((u) => {
                    u.user.currentlyActive = true;
                    u.user.presence = "online";
                    u.user.lastPresenceTs = 1000;
                    u.user.lastActiveAgo = 0;
                    u.powerLevel = 100;
                });

                // Bypass all the event listeners and skip to the good part
                memberList._showPresence = enablePresence;
                memberList._updateListNow();

                const tiles = ReactTestUtils.scryRenderedComponentsWithType(root, MemberTile);
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });
        });
    }

    describe('when presence is enabled', () => {
        itDoesOrderMembersCorrectly(true);
    });

    describe('when presence is not enabled', () => {
        itDoesOrderMembersCorrectly(false);
    });
});


