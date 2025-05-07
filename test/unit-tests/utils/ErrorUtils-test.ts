/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactElement } from "react";
import { render } from "jest-matrix-react";
import { MatrixError, ConnectionError } from "matrix-js-sdk/src/matrix";

import {
    adminContactStrings,
    messageForConnectionError,
    messageForLoginError,
    messageForResourceLimitError,
    messageForSyncError,
    resourceLimitStrings,
} from "../../../src/utils/ErrorUtils";

describe("messageForResourceLimitError", () => {
    it("should match snapshot for monthly_active_user", () => {
        const { asFragment } = render(
            messageForResourceLimitError("monthly_active_user", "some@email", resourceLimitStrings) as ReactElement,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for admin contact links", () => {
        const { asFragment } = render(
            messageForResourceLimitError("", "some@email", adminContactStrings) as ReactElement,
        );

        expect(asFragment()).toMatchSnapshot();
    });
});

describe("messageForSyncError", () => {
    it("should match snapshot for M_RESOURCE_LIMIT_EXCEEDED", () => {
        const err = new MatrixError({
            errcode: "M_RESOURCE_LIMIT_EXCEEDED",
            data: {
                limit_type: "monthly_active_user",
                admin_contact: "some@email",
            },
        });
        const { asFragment } = render(messageForSyncError(err) as ReactElement);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for other errors", () => {
        const err = new MatrixError({
            errcode: "OTHER_ERROR",
        });
        const { asFragment } = render(messageForSyncError(err) as ReactElement);
        expect(asFragment()).toMatchSnapshot();
    });
});

describe("messageForLoginError", () => {
    it("should match snapshot for M_RESOURCE_LIMIT_EXCEEDED", () => {
        const err = new MatrixError({
            errcode: "M_RESOURCE_LIMIT_EXCEEDED",
            data: {
                limit_type: "monthly_active_user",
                admin_contact: "some@email",
            },
        });
        const { asFragment } = render(
            messageForLoginError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for M_USER_DEACTIVATED", () => {
        const err = new MatrixError(
            {
                errcode: "M_USER_DEACTIVATED",
            },
            403,
        );
        const { asFragment } = render(
            messageForLoginError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for 401", () => {
        const err = new MatrixError(
            {
                errcode: "UNKNOWN",
            },
            401,
        );
        const { asFragment } = render(
            messageForLoginError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for unknown error", () => {
        const err = new MatrixError({}, 400);
        const { asFragment } = render(
            messageForLoginError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});

describe("messageForConnectionError", () => {
    it("should match snapshot for ConnectionError", () => {
        const err = new ConnectionError("Internal Server Error", new MatrixError({}, 500));
        const { asFragment } = render(
            messageForConnectionError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for MatrixError M_NOT_FOUND", () => {
        const err = new MatrixError(
            {
                errcode: "M_NOT_FOUND",
            },
            404,
        );
        const { asFragment } = render(
            messageForConnectionError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for unknown error", () => {
        const err = new Error("What even");
        const { asFragment } = render(
            messageForConnectionError(err, {
                hsUrl: "hsUrl",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should match snapshot for mixed content error", () => {
        const err = new ConnectionError("Mixed content maybe?");
        Object.defineProperty(window, "location", { value: { protocol: "https:" } });
        const { asFragment } = render(
            messageForConnectionError(err, {
                hsUrl: "http://server.com",
                hsName: "hsName",
            }) as ReactElement,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
