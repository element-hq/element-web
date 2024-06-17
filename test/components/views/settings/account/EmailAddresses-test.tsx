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
import { render, screen } from "@testing-library/react";
import { IThreepid, ThreepidMedium } from "matrix-js-sdk/src/matrix";

import EmailAddresses from "../../../../../src/components/views/settings/account/EmailAddresses";
import { clearAllModals } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../../src/settings/UIFeature";

const mockGetAccessToken = jest.fn().mockResolvedValue("getAccessToken");
jest.mock("../../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

const emailThreepidFixture: IThreepid = {
    medium: ThreepidMedium.Email,
    address: "foo@bar.com",
    validated_at: 12345,
    added_at: 12342,
    bound: false,
};

describe("<ExistingEmailAddress/>", () => {
    const mockEvent = jest.fn();

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(async () => {
        jest.useRealTimers();
        await clearAllModals();
    });

    it("do not render 'remove' button when option UIFeature is false", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === UIFeature.EmailAddressShowRemoveButton) return false;
            return true;
        });

        const { container } = render(
            <EmailAddresses emails={[emailThreepidFixture]} onEmailsChange={mockEvent} disabled={false} />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.queryByText("Remove")).toBeFalsy();
    });
    it("render 'remove' button when UIFeature is true and an existing email exists", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === UIFeature.EmailAddressShowRemoveButton) return true;
            return true;
        });

        const { container } = render(
            <EmailAddresses emails={[emailThreepidFixture]} onEmailsChange={mockEvent} disabled={false} />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.queryByText("Remove")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });
    it("do not render 'Add' button when UIFeature is false", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === UIFeature.EmailAddressShowAddButton) return false;
            return true;
        });

        const { container } = render(
            <EmailAddresses emails={[emailThreepidFixture]} onEmailsChange={mockEvent} disabled={false} />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.queryByText("Add")).toBeFalsy();
    });
    it("render 'Add' button when UIFeature is true", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            if (setting === UIFeature.EmailAddressShowAddButton) return true;
            return true;
        });

        const { container } = render(
            <EmailAddresses emails={[emailThreepidFixture]} onEmailsChange={mockEvent} disabled={false} />,
        );
        // container.setState({ verifyRemove: true });

        expect(container).toMatchSnapshot();
        expect(screen.queryByText("Add")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    });
});
