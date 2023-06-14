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

import "../../olm-loader";
import { RendezvousFailureReason, RendezvousIntent } from "../../../src/rendezvous";
import { MSC3903ECDHPayload, MSC3903ECDHv2RendezvousChannel } from "../../../src/rendezvous/channels";
import { decodeBase64 } from "../../../src/crypto/olmlib";
import { DummyTransport } from "./DummyTransport";

function makeTransport(name: string) {
    return new DummyTransport<any, MSC3903ECDHPayload>(name, { type: "dummy" });
}

describe("ECDHv2", function () {
    beforeAll(async function () {
        await global.Olm.init();
    });

    describe("with crypto", () => {
        it("initiator wants to sign in", async function () {
            const aliceTransport = makeTransport("Alice");
            const bobTransport = makeTransport("Bob");
            aliceTransport.otherParty = bobTransport;
            bobTransport.otherParty = aliceTransport;

            // alice is signing in initiates and generates a code
            const alice = new MSC3903ECDHv2RendezvousChannel(aliceTransport);
            const aliceCode = await alice.generateCode(RendezvousIntent.LOGIN_ON_NEW_DEVICE);
            const bob = new MSC3903ECDHv2RendezvousChannel(bobTransport, decodeBase64(aliceCode.rendezvous.key));

            const bobChecksum = await bob.connect();
            const aliceChecksum = await alice.connect();

            expect(aliceChecksum).toEqual(bobChecksum);

            const message = { key: "xxx" };
            await alice.send(message);
            const bobReceive = await bob.receive();
            expect(bobReceive).toEqual(message);

            await alice.cancel(RendezvousFailureReason.Unknown);
            await bob.cancel(RendezvousFailureReason.Unknown);
        });

        it("initiator wants to reciprocate", async function () {
            const aliceTransport = makeTransport("Alice");
            const bobTransport = makeTransport("Bob");
            aliceTransport.otherParty = bobTransport;
            bobTransport.otherParty = aliceTransport;

            // alice is signing in initiates and generates a code
            const alice = new MSC3903ECDHv2RendezvousChannel(aliceTransport);
            const aliceCode = await alice.generateCode(RendezvousIntent.LOGIN_ON_NEW_DEVICE);
            const bob = new MSC3903ECDHv2RendezvousChannel(bobTransport, decodeBase64(aliceCode.rendezvous.key));

            const bobChecksum = await bob.connect();
            const aliceChecksum = await alice.connect();

            expect(aliceChecksum).toEqual(bobChecksum);

            const message = { key: "xxx" };
            await bob.send(message);
            const aliceReceive = await alice.receive();
            expect(aliceReceive).toEqual(message);

            await alice.cancel(RendezvousFailureReason.Unknown);
            await bob.cancel(RendezvousFailureReason.Unknown);
        });

        it("double connect", async function () {
            const aliceTransport = makeTransport("Alice");
            const bobTransport = makeTransport("Bob");
            aliceTransport.otherParty = bobTransport;
            bobTransport.otherParty = aliceTransport;

            // alice is signing in initiates and generates a code
            const alice = new MSC3903ECDHv2RendezvousChannel(aliceTransport);
            const aliceCode = await alice.generateCode(RendezvousIntent.LOGIN_ON_NEW_DEVICE);
            const bob = new MSC3903ECDHv2RendezvousChannel(bobTransport, decodeBase64(aliceCode.rendezvous.key));

            const bobChecksum = await bob.connect();
            const aliceChecksum = await alice.connect();

            expect(aliceChecksum).toEqual(bobChecksum);

            expect(alice.connect()).rejects.toThrow();

            await alice.cancel(RendezvousFailureReason.Unknown);
            await bob.cancel(RendezvousFailureReason.Unknown);
        });

        it("closed", async function () {
            const aliceTransport = makeTransport("Alice");
            const bobTransport = makeTransport("Bob");
            aliceTransport.otherParty = bobTransport;
            bobTransport.otherParty = aliceTransport;

            // alice is signing in initiates and generates a code
            const alice = new MSC3903ECDHv2RendezvousChannel(aliceTransport);
            const aliceCode = await alice.generateCode(RendezvousIntent.LOGIN_ON_NEW_DEVICE);
            const bob = new MSC3903ECDHv2RendezvousChannel(bobTransport, decodeBase64(aliceCode.rendezvous.key));

            const bobChecksum = await bob.connect();
            const aliceChecksum = await alice.connect();

            expect(aliceChecksum).toEqual(bobChecksum);

            alice.close();

            expect(alice.connect()).rejects.toThrow();
            expect(alice.send({})).rejects.toThrow();
            expect(alice.receive()).rejects.toThrow();

            await alice.cancel(RendezvousFailureReason.Unknown);
            await bob.cancel(RendezvousFailureReason.Unknown);
        });

        it("require ciphertext", async function () {
            const aliceTransport = makeTransport("Alice");
            const bobTransport = makeTransport("Bob");
            aliceTransport.otherParty = bobTransport;
            bobTransport.otherParty = aliceTransport;

            // alice is signing in initiates and generates a code
            const alice = new MSC3903ECDHv2RendezvousChannel(aliceTransport);
            const aliceCode = await alice.generateCode(RendezvousIntent.LOGIN_ON_NEW_DEVICE);
            const bob = new MSC3903ECDHv2RendezvousChannel(bobTransport, decodeBase64(aliceCode.rendezvous.key));

            const bobChecksum = await bob.connect();
            const aliceChecksum = await alice.connect();

            expect(aliceChecksum).toEqual(bobChecksum);

            // send a message without encryption
            await aliceTransport.send({ iv: "dummy", ciphertext: "dummy" });
            expect(bob.receive()).rejects.toThrow();

            await alice.cancel(RendezvousFailureReason.Unknown);
            await bob.cancel(RendezvousFailureReason.Unknown);
        });

        it("ciphertext before set up", async function () {
            const aliceTransport = makeTransport("Alice");
            const bobTransport = makeTransport("Bob");
            aliceTransport.otherParty = bobTransport;
            bobTransport.otherParty = aliceTransport;

            // alice is signing in initiates and generates a code
            const alice = new MSC3903ECDHv2RendezvousChannel(aliceTransport);
            await alice.generateCode(RendezvousIntent.LOGIN_ON_NEW_DEVICE);

            await bobTransport.send({ iv: "dummy", ciphertext: "dummy" });

            expect(alice.receive()).rejects.toThrow();

            await alice.cancel(RendezvousFailureReason.Unknown);
        });
    });
});
