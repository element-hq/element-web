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

import React from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import PhoneNumbers from "../../../../../src/components/views/settings/account/PhoneNumbers";
import { stubClient } from "../../../../test-utils";
import SdkConfig from "../../../../../src/SdkConfig";

describe("<PhoneNumbers />", () => {
    it("should allow a phone number to be added", async () => {
        SdkConfig.add({
            default_country_code: "GB",
        });

        const cli = stubClient();
        const onMsisdnsChange = jest.fn();
        const { asFragment, getByLabelText, getByText } = render(
            <PhoneNumbers msisdns={[]} onMsisdnsChange={onMsisdnsChange} />,
        );

        mocked(cli.requestAdd3pidMsisdnToken).mockResolvedValue({
            sid: "SID",
            msisdn: "447900111222",
            submit_url: "https://server.url",
            success: true,
            intl_fmt: "no-clue",
        });
        mocked(cli.submitMsisdnTokenOtherUrl).mockResolvedValue({ success: true });
        mocked(cli.addThreePidOnly).mockResolvedValue({});

        const phoneNumberField = getByLabelText("Phone Number");
        await userEvent.type(phoneNumberField, "7900111222");
        await userEvent.click(getByText("Add"));

        expect(cli.requestAdd3pidMsisdnToken).toHaveBeenCalledWith("GB", "7900111222", "t35tcl1Ent5ECr3T", 1);
        expect(asFragment()).toMatchSnapshot();

        const verificationCodeField = getByLabelText("Verification code");
        await userEvent.type(verificationCodeField, "123666");
        await userEvent.click(getByText("Continue"));

        expect(cli.submitMsisdnTokenOtherUrl).toHaveBeenCalledWith(
            "https://server.url",
            "SID",
            "t35tcl1Ent5ECr3T",
            "123666",
        );
        expect(onMsisdnsChange).toHaveBeenCalledWith([{ address: "447900111222", medium: "msisdn" }]);
    });
});
