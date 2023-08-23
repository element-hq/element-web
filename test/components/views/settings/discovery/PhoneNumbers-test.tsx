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

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IThreepid, ThreepidMedium } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import PhoneNumbers, { PhoneNumber } from "../../../../../src/components/views/settings/discovery/PhoneNumbers";
import { stubClient } from "../../../../test-utils";

const msisdn: IThreepid = {
    medium: ThreepidMedium.Phone,
    address: "441111111111",
    validated_at: 12345,
    added_at: 12342,
    bound: false,
};
describe("<PhoneNumber/>", () => {
    it("should track props.msisdn.bound changes", async () => {
        const { rerender } = render(<PhoneNumber msisdn={{ ...msisdn }} />);
        await screen.findByText("Share");

        rerender(<PhoneNumber msisdn={{ ...msisdn, bound: true }} />);
        await screen.findByText("Revoke");
    });
});

const mockGetAccessToken = jest.fn().mockResolvedValue("$$getAccessToken");
jest.mock("../../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

describe("<PhoneNumbers />", () => {
    it("should render a loader while loading", async () => {
        const { container } = render(<PhoneNumbers msisdns={[{ ...msisdn }]} isLoading={true} />);

        expect(container).toMatchSnapshot();
    });

    it("should render phone numbers", async () => {
        const { container } = render(<PhoneNumbers msisdns={[{ ...msisdn }]} isLoading={false} />);

        expect(container).toMatchSnapshot();
    });

    it("should handle no numbers", async () => {
        const { container } = render(<PhoneNumbers msisdns={[]} isLoading={false} />);

        expect(container).toMatchSnapshot();
    });

    it("should allow binding msisdn", async () => {
        const cli = stubClient();
        const { getByText, getByLabelText, asFragment } = render(
            <PhoneNumbers msisdns={[{ ...msisdn }]} isLoading={false} />,
        );

        mocked(cli.requestMsisdnToken).mockResolvedValue({
            sid: "SID",
            msisdn: "+447900111222",
            submit_url: "https://server.url",
            success: true,
            intl_fmt: "no-clue",
        });

        fireEvent.click(getByText("Share"));
        await waitFor(() =>
            expect(cli.requestMsisdnToken).toHaveBeenCalledWith(
                null,
                "+441111111111",
                "t35tcl1Ent5ECr3T",
                1,
                undefined,
                "$$getAccessToken",
            ),
        );
        expect(asFragment()).toMatchSnapshot();

        const verificationCodeField = getByLabelText("Verification code");
        await userEvent.type(verificationCodeField, "123666{Enter}");

        expect(cli.submitMsisdnToken).toHaveBeenCalledWith("SID", "t35tcl1Ent5ECr3T", "123666", "$$getAccessToken");
    });
});
