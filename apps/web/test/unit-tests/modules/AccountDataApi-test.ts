/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent } from "matrix-js-sdk/src/matrix";

import { AccountDataApi } from "../../../src/modules/AccountDataApi";
import { mkEvent, stubClient } from "../../test-utils/test-utils";

describe("AccountDataApi", () => {
    describe("AccountDataWatchable", () => {
        it("should return content of account data event on get()", () => {
            const cli = stubClient();
            const api = new AccountDataApi();
            // Mock cli to return a event
            const content = { foo: "bar" };
            const event = mkEvent({ content, type: "m.test", user: "@foobar:matrix.org", event: true });
            cli.getAccountData = () => event;
            expect(api.get("m.test").value).toStrictEqual(content);
        });

        it("should update value on event", () => {
            const cli = stubClient();
            const api = new AccountDataApi();
            // Mock cli to return a event
            const content = { foo: "bar" };
            const event = mkEvent({ content, type: "m.test", user: "@foobar:matrix.org", event: true });
            cli.getAccountData = () => event;

            const watchable = api.get("m.test");
            expect(watchable.value).toStrictEqual(content);

            const fn = jest.fn();
            watchable.watch(fn);

            // Let's say that the account data event changed
            const event2 = mkEvent({
                content: { foo: "abc" },
                type: "m.test",
                user: "@foobar:matrix.org",
                event: true,
            });
            cli.emit(ClientEvent.AccountData, event2);
            // Watchable value should have been updated
            expect(watchable.value).toStrictEqual({ foo: "abc" });
            // Watched callbacks should be called
            expect(fn).toHaveBeenCalledTimes(1);

            // Make sure unwatch removed the event listener
            cli.off = jest.fn();
            watchable.unwatch(fn);
            expect(cli.off).toHaveBeenCalledTimes(1);
        });
    });

    it("should set account data via js-sdk on set()", async () => {
        const cli = stubClient();
        const api = new AccountDataApi();
        await api.set("m.test", { foo: "bar" });
        expect(cli.setAccountData).toHaveBeenCalledTimes(1);
    });

    it("should delete account data via js-sdk on set()", async () => {
        const cli = stubClient();
        const api = new AccountDataApi();
        await api.delete("m.test");
        expect(cli.deleteAccountData).toHaveBeenCalledTimes(1);
    });
});
