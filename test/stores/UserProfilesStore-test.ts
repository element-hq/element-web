/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { mocked, Mocked } from "jest-mock";
import {
    IMatrixProfile,
    MatrixClient,
    MatrixError,
    MatrixEvent,
    Room,
    RoomMemberEvent,
} from "matrix-js-sdk/src/matrix";

import { UserProfilesStore } from "../../src/stores/UserProfilesStore";
import { filterConsole, mkRoomMember, mkRoomMemberJoinEvent, stubClient } from "../test-utils";

describe("UserProfilesStore", () => {
    const userIdDoesNotExist = "@unknown:example.com";
    const userDoesNotExistError = new MatrixError({
        errcode: "M_NOT_FOUND",
        error: "Profile not found",
    });

    const user1Id = "@user1:example.com";
    const user1Profile: IMatrixProfile = { displayname: "User 1", avatar_url: undefined };
    const user2Id = "@user2:example.com";
    const user2Profile: IMatrixProfile = { displayname: "User 2", avatar_url: undefined };
    const user3Id = "@user3:example.com";
    let mockClient: Mocked<MatrixClient>;
    let userProfilesStore: UserProfilesStore;
    let room: Room;

    filterConsole(
        "Error retrieving profile for userId @unknown:example.com",
        "Error retrieving profile for userId @user3:example.com",
    );

    beforeEach(() => {
        mockClient = mocked(stubClient());
        room = new Room("!room:example.com", mockClient, mockClient.getSafeUserId());
        room.currentState.setStateEvents([
            mkRoomMemberJoinEvent(user2Id, room.roomId),
            mkRoomMemberJoinEvent(user3Id, room.roomId),
        ]);
        mockClient.getRooms.mockReturnValue([room]);
        userProfilesStore = new UserProfilesStore(mockClient);

        mockClient.getProfileInfo.mockImplementation(async (userId: string) => {
            if (userId === user1Id) return user1Profile;
            if (userId === user2Id) return user2Profile;

            throw userDoesNotExistError;
        });
    });

    it("getProfile should return undefined if the profile was not fetched", () => {
        expect(userProfilesStore.getProfile(user1Id)).toBeUndefined();
    });

    describe("fetchProfile", () => {
        it("should return the profile from the API and cache it", async () => {
            const profile = await userProfilesStore.fetchProfile(user1Id);
            expect(profile).toBe(user1Profile);
            expect(userProfilesStore.getProfile(user1Id)).toBe(user1Profile);
        });

        it("when shouldThrow = true and there is an error it should raise an error", async () => {
            await expect(userProfilesStore.fetchProfile(userIdDoesNotExist, { shouldThrow: true })).rejects.toThrow(
                userDoesNotExistError.message,
            );
        });

        describe("when fetching a profile that does not exist", () => {
            let profile: IMatrixProfile | null | undefined;

            beforeEach(async () => {
                profile = await userProfilesStore.fetchProfile(userIdDoesNotExist);
            });

            it("should return null", () => {
                expect(profile).toBeNull();
            });

            it("should cache the error and result", () => {
                expect(userProfilesStore.getProfile(userIdDoesNotExist)).toBeNull();
                expect(userProfilesStore.getProfileLookupError(userIdDoesNotExist)).toBe(userDoesNotExistError);
            });

            describe("when the profile does not exist and fetching it again", () => {
                beforeEach(async () => {
                    mockClient.getProfileInfo.mockResolvedValue(user1Profile);
                    profile = await userProfilesStore.fetchProfile(userIdDoesNotExist);
                });

                it("should return the profile", () => {
                    expect(profile).toBe(user1Profile);
                });

                it("should clear the error", () => {
                    expect(userProfilesStore.getProfileLookupError(userIdDoesNotExist)).toBeUndefined();
                });
            });
        });
    });

    describe("getOrFetchProfile", () => {
        it("should return a profile from the API and cache it", async () => {
            const profile = await userProfilesStore.getOrFetchProfile(user1Id);
            expect(profile).toBe(user1Profile);
            // same method again
            expect(await userProfilesStore.getOrFetchProfile(user1Id)).toBe(user1Profile);
            // assert that the profile is cached
            expect(userProfilesStore.getProfile(user1Id)).toBe(user1Profile);
        });
    });

    describe("getProfileLookupError", () => {
        it("should return undefined if a profile was not fetched", () => {
            expect(userProfilesStore.getProfileLookupError(user1Id)).toBeUndefined();
        });

        it("should return undefined if a profile was successfully fetched", async () => {
            await userProfilesStore.fetchProfile(user1Id);
            expect(userProfilesStore.getProfileLookupError(user1Id)).toBeUndefined();
        });

        it("should return the error if there was one", async () => {
            await userProfilesStore.fetchProfile(userIdDoesNotExist);
            expect(userProfilesStore.getProfileLookupError(userIdDoesNotExist)).toBe(userDoesNotExistError);
        });
    });

    it("getOnlyKnownProfile should return undefined if the profile was not fetched", () => {
        expect(userProfilesStore.getOnlyKnownProfile(user1Id)).toBeUndefined();
    });

    describe("fetchOnlyKnownProfile", () => {
        it("should return undefined if no room shared with the user", async () => {
            const profile = await userProfilesStore.fetchOnlyKnownProfile(user1Id);
            expect(profile).toBeUndefined();
            expect(userProfilesStore.getOnlyKnownProfile(user1Id)).toBeUndefined();
        });

        it("for a known user should return the profile from the API and cache it", async () => {
            const profile = await userProfilesStore.fetchOnlyKnownProfile(user2Id);
            expect(profile).toBe(user2Profile);
            expect(userProfilesStore.getOnlyKnownProfile(user2Id)).toBe(user2Profile);
        });

        it("for a known user not found via API should return null and cache it", async () => {
            const profile = await userProfilesStore.fetchOnlyKnownProfile(user3Id);
            expect(profile).toBeNull();
            expect(userProfilesStore.getOnlyKnownProfile(user3Id)).toBeNull();
        });
    });

    describe("when there are cached values and membership updates", () => {
        beforeEach(async () => {
            await userProfilesStore.fetchProfile(user1Id);
            await userProfilesStore.fetchOnlyKnownProfile(user2Id);
        });

        describe("and membership events with the same values appear", () => {
            beforeEach(() => {
                const roomMember1 = mkRoomMember(room.roomId, user1Id);
                roomMember1.rawDisplayName = user1Profile.displayname!;
                roomMember1.getMxcAvatarUrl = () => undefined;
                mockClient.emit(RoomMemberEvent.Membership, {} as MatrixEvent, roomMember1);

                const roomMember2 = mkRoomMember(room.roomId, user2Id);
                roomMember2.rawDisplayName = user2Profile.displayname!;
                roomMember2.getMxcAvatarUrl = () => undefined;
                mockClient.emit(RoomMemberEvent.Membership, {} as MatrixEvent, roomMember2);
            });

            it("should not invalidate the cache", () => {
                expect(userProfilesStore.getProfile(user1Id)).toBe(user1Profile);
                expect(userProfilesStore.getOnlyKnownProfile(user2Id)).toBe(user2Profile);
            });
        });
    });

    describe("flush", () => {
        it("should clear profiles, known profiles and errors", async () => {
            await userProfilesStore.fetchOnlyKnownProfile(user1Id);
            await userProfilesStore.fetchProfile(user1Id);
            await userProfilesStore.fetchProfile(userIdDoesNotExist);

            userProfilesStore.flush();

            expect(userProfilesStore.getProfile(user1Id)).toBeUndefined();
            expect(userProfilesStore.getOnlyKnownProfile(user1Id)).toBeUndefined();
            expect(userProfilesStore.getProfileLookupError(userIdDoesNotExist)).toBeUndefined();
        });
    });
});
