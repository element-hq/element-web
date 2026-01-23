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
        decryptionFailureReason: DecryptionFailureReason | null,
        isLocalDeviceVerified: boolean = false,
    ): ReturnType<typeof render> {
        return render(
            <DecryptionFailureBodyView vm={new MockViewModel({ decryptionFailureReason, isLocalDeviceVerified })} />,
        );
    }

    function customRenderWithRef(ref: React.RefObject<any>): ReturnType<typeof render> {
        return render(
            <DecryptionFailureBodyView
                vm={new MockViewModel({ decryptionFailureReason: DecryptionFailureReason.UNKNOWN_ERROR })}
                ref={ref}
            />,
        );
    }

    it(`Should display "Unable to decrypt message"`, () => {
        // When
        const { container } = customRender(null);

        // Then
        expect(container).toMatchSnapshot();
    });

    it(`Should display "The sender has blocked you from receiving this message"`, async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE);

        // Then
        expect(container).toMatchSnapshot();
    });

    it("should handle historical messages with no key backup", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP);

        // Then
        expect(container).toHaveTextContent("Historical messages are not available on this device");
    });

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

    it("should handle undecryptable pre-join messages", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED);

        // Then
        expect(container).toHaveTextContent("You don't have access to this message");
    });

    it("should handle messages from users who change identities after verification", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED);

        // Then
        expect(container).toMatchSnapshot();
    });

    it("should handle messages from unverified devices", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.UNSIGNED_SENDER_DEVICE);

        // Then
        expect(container).toHaveTextContent("Sent from an insecure device");
    });

    it("should handle ref input", async () => {
        const ref = React.createRef<HTMLDivElement>();
        // When
        const { container } = customRenderWithRef(ref);

        // Then
        expect(container).toBeInstanceOf(HTMLDivElement);
        expect(container.firstChild).toHaveTextContent("Unable to decrypt message");
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
});
