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

import { Mocked } from "jest-mock";
import { IIdentityServerProvider } from "matrix-js-sdk/src/@types/IIdentityServerProvider";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { DirectoryMember, ThreepidMember } from "../../src/utils/direct-messages";
import { lookupThreePids, resolveThreePids } from "../../src/utils/threepids";
import { stubClient } from "../test-utils";

describe("threepids", () => {
    let client: Mocked<MatrixClient>;
    const accessToken = "s3cr3t";
    let identityServer: Mocked<IIdentityServerProvider>;

    beforeEach(() => {
        client = stubClient() as Mocked<MatrixClient>;
        identityServer = {
            getAccessToken: jest.fn().mockResolvedValue(accessToken),
        } as unknown as Mocked<IIdentityServerProvider>;
    });

    describe("resolveThreePids", () => {
        const userId = "@user1:example.com";
        const directoryMember = new DirectoryMember({
            user_id: userId,
        });

        const threePid1Id = "three1@example.com";
        const threePid1MXID = "@three1:example.com";
        const threePid1Member = new ThreepidMember(threePid1Id);
        const threePid1Displayname = "Three Pid 1";
        const threePid2Id = "three2@example.com";
        const threePid2MXID = "@three2:example.com";
        const threePid2Member = new ThreepidMember(threePid2Id);
        const threePid3Id = "three3@example.com";
        const threePid3Member = new ThreepidMember(threePid3Id);
        const threePidPhoneId = "8801500121121";
        const threePidPhoneMember = new ThreepidMember(threePidPhoneId);

        it("should return an empty list for an empty input", async () => {
            expect(await resolveThreePids([], client)).toEqual([]);
        });

        it("should return the same list for non-3rd-party members", async () => {
            expect(await resolveThreePids([directoryMember], client)).toEqual([directoryMember]);
        });

        it("should return the same list for if no identity server is configured", async () => {
            expect(await resolveThreePids([directoryMember, threePid1Member], client)).toEqual([
                directoryMember,
                threePid1Member,
            ]);
        });

        describe("when an identity server is configured", () => {
            beforeEach(() => {
                client.identityServer = identityServer;
            });

            it("should return the same list if the lookup doesn't return any results", async () => {
                expect(
                    await resolveThreePids(
                        [directoryMember, threePid1Member, threePid2Member, threePidPhoneMember],
                        client,
                    ),
                ).toEqual([directoryMember, threePid1Member, threePid2Member, threePidPhoneMember]);
                expect(client.bulkLookupThreePids).toHaveBeenCalledWith(
                    [
                        ["email", threePid1Id],
                        ["email", threePid2Id],
                        ["msisdn", threePidPhoneId],
                    ],
                    accessToken,
                );
            });

            describe("and some 3-rd party members can be resolved", () => {
                beforeEach(() => {
                    client.bulkLookupThreePids.mockResolvedValue({
                        threepids: [
                            ["email", threePid1Id, threePid1MXID],
                            ["email", threePid2Id, threePid2MXID],
                        ],
                    });
                });

                it("should return the resolved members", async () => {
                    expect(
                        await resolveThreePids(
                            [directoryMember, threePid1Member, threePid2Member, threePid3Member],
                            client,
                        ),
                    ).toEqual([
                        directoryMember,
                        new DirectoryMember({ user_id: threePid1MXID }),
                        new DirectoryMember({ user_id: threePid2MXID }),
                        threePid3Member,
                    ]);
                    expect(client.bulkLookupThreePids).toHaveBeenCalledWith(
                        [
                            ["email", threePid1Id],
                            ["email", threePid2Id],
                            ["email", threePid3Id],
                        ],
                        accessToken,
                    );
                });

                describe("and some 3rd-party members have a profile", () => {
                    beforeEach(() => {
                        client.getProfileInfo.mockImplementation((matrixId: string) => {
                            if (matrixId === threePid1MXID)
                                return Promise.resolve({ displayname: threePid1Displayname });
                            throw new Error("Profile not found");
                        });
                    });

                    it("should resolve the profiles", async () => {
                        expect(
                            await resolveThreePids(
                                [directoryMember, threePid1Member, threePid2Member, threePid3Member],
                                client,
                            ),
                        ).toEqual([
                            directoryMember,
                            new DirectoryMember({ user_id: threePid1MXID, display_name: threePid1Displayname }),
                            new DirectoryMember({ user_id: threePid2MXID }),
                            threePid3Member,
                        ]);
                    });
                });
            });
        });
    });

    describe("lookupThreePids", () => {
        it("should return an empty list for an empty list", async () => {
            client.identityServer = identityServer;
            expect(await lookupThreePids([], client)).toEqual([]);
        });
    });
});
