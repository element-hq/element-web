/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";

import { DecryptionFailureBodyView, DecryptionFailureReason } from "./DecryptionFailureBodyView";
import { MockViewModel } from "../../viewmodel";

describe("DecryptionFailureBodyView", () => {
    function customRender(
        decryptionFailureReason: DecryptionFailureReason,
        isLocalDeviceVerified: boolean = false,
        extraClassNames: string[] | undefined = undefined,
    ): ReturnType<typeof render> {
        return render(
            <DecryptionFailureBodyView
                vm={new MockViewModel({ decryptionFailureReason, isLocalDeviceVerified, extraClassNames })}
            />,
        );
    }

    function customRenderWithRef(ref: React.RefObject<any>): ReturnType<typeof render> {
        return render(
            <DecryptionFailureBodyView
                vm={new MockViewModel({ decryptionFailureReason: DecryptionFailureReason.UNABLE_TO_DECRYPT })}
                ref={ref}
            />,
        );
    }

    it("Should display with extra class names", () => {
        // When
        const { container } = customRender(DecryptionFailureReason.UNABLE_TO_DECRYPT, true, ["class1", "class2"]);

        // Then
        expect(container.firstChild).toHaveClass("class1");
        expect(container.firstChild).toHaveClass("class2");
        expect(container).toMatchSnapshot();
    });

    it.each([true, false])(`Should display "Unable to decrypt message and device verification is %s"`, (verified) => {
        // When
        const { container } = customRender(DecryptionFailureReason.UNABLE_TO_DECRYPT, verified);

        // Then
        expect(container).toHaveTextContent("Unable to decrypt message");
        expect(container).toMatchSnapshot();
    });

    it.each([true, false])(
        `Should display "The sender has blocked you from receiving this message and device verification is %s"`,
        (verified) => {
            // When
            const { container } = customRender(
                DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE,
                verified,
            );

            // Then
            expect(container).toHaveTextContent(
                "The sender has blocked you from receiving this message because your device is unverified",
            );
            expect(container).toMatchSnapshot();
        },
    );

    it.each([true, false])(
        "should handle historical messages with no key backup and device verification is %s",
        (verified) => {
            // When
            const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP, verified);

            // Then
            expect(container).toHaveTextContent("Historical messages are not available on this device");
            expect(container).toMatchSnapshot();
        },
    );

    it.each([true, false])(
        "should handle historical messages when there is a backup and device verification is %s",
        async (verified) => {
            // When
            const { container } = customRender(
                DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED,
                verified,
            );

            // Then
            expect(container).toHaveTextContent(
                verified ? "Unable to decrypt" : "You need to verify this device for access to historical messages",
            );
        },
    );

    it.each([true, false])(
        "should handle undecryptable pre-join messages and device verification is %s",
        (verified) => {
            // When
            const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED, verified);

            // Then
            expect(container).toHaveTextContent("You don't have access to this message");
            expect(container).toMatchSnapshot();
        },
    );

    it.each([true, false])(
        "should handle messages from users who change identities after verification and device verification is %s",
        (verified) => {
            // When
            const { container } = customRender(DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED, verified);

            // Then
            expect(container).toHaveTextContent("Sender's verified identity was reset");
            expect(container).toMatchSnapshot();
        },
    );

    it.each([true, false])(
        "should handle messages from unverified devices and device verification is %s",
        (verified) => {
            // When
            const { container } = customRender(DecryptionFailureReason.UNSIGNED_SENDER_DEVICE, verified);

            // Then
            expect(container).toHaveTextContent("Sent from an insecure device");
            expect(container).toMatchSnapshot();
        },
    );

    it("should handle ref input", async () => {
        const ref = React.createRef<HTMLDivElement>();
        // Whenq
        const { container } = customRenderWithRef(ref);

        // Then
        expect(container).toBeInstanceOf(HTMLDivElement);
        expect(container.firstChild).toHaveTextContent("Unable to decrypt message");
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
});
