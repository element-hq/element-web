/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { AccountDataApi } from "../../../src/modules/AccountDataApi";
import * as utils from "../../../src/modules/common";
import { mkEvent, stubClient } from "../../test-utils/test-utils";

describe("AccountDataApi", () => {
    it("should return content of account data event on get()", () => {
        const cli = stubClient();
        jest.spyOn(utils, "getSafeCli").mockReturnValue(cli);
        const api = new AccountDataApi();
        // Mock cli to return a event
        const content = { foo: "bar" };
        const event = mkEvent({ content, type: "m.test", user: "@foobar:matrix.org", event: true });
        cli.getAccountData = () => event;
        expect(api.get("m.test").value).toStrictEqual(content);
    });

    it("should set account data via js-sdk on set()", async () => {
        const cli = stubClient();
        jest.spyOn(utils, "getSafeCli").mockReturnValue(cli);
        const api = new AccountDataApi();
        await api.set("m.test", { foo: "bar" });
        expect(cli.setAccountData).toHaveBeenCalledTimes(1);
    });

    it("should delete account data via js-sdk on set()", async () => {
        const cli = stubClient();
        jest.spyOn(utils, "getSafeCli").mockReturnValue(cli);
        const api = new AccountDataApi();
        await api.delete("m.test");
        expect(cli.deleteAccountData).toHaveBeenCalledTimes(1);
    });
});
