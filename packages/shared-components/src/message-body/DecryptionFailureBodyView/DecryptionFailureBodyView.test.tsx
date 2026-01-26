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

    it(`Should display "Unable to decrypt message"`, () => {
        // When
        const { container } = customRender(DecryptionFailureReason.UNABLE_TO_DECRYPT);

        // Then
        expect(container).toHaveTextContent("Unable to decrypt message");
        expect(container).toMatchSnapshot();
    });

    it(`Should display "The sender has blocked you from receiving this message"`, async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE);

        // Then
        expect(container).toHaveTextContent(
            "The sender has blocked you from receiving this message because your device is unverified",
        );
        expect(container).toMatchSnapshot();
    });

    it("should handle historical messages with no key backup", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP);

        // Then
        expect(container).toHaveTextContent("Historical messages are not available on this device");
        expect(container).toMatchSnapshot();
    });

    it("should handle historical messages when there is a backup and device verification is true", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED, true);

        // Then
        expect(container).toHaveTextContent("Unable to decrypt");
        expect(container).toMatchSnapshot();
    });

    it("should handle historical messages when there is a backup and device verification is false", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED, false);

        // Then
        expect(container).toHaveTextContent("You need to verify this device for access to historical messages");
    });

    it("should handle undecryptable pre-join messages", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED);

        // Then
        expect(container).toHaveTextContent("You don't have access to this message");
        expect(container).toMatchSnapshot();
    });

    it("should handle messages from users who change identities after verification", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED);

        // Then
        expect(container).toHaveTextContent("Sender's verified identity was reset");
        expect(container).toMatchSnapshot();
    });

    it("should handle messages from unverified devices", async () => {
        // When
        const { container } = customRender(DecryptionFailureReason.UNSIGNED_SENDER_DEVICE);

        // Thenu
        expect(container).toHaveTextContent("Sent from an insecure device");
        expect(container).toMatchSnapshot();
    });

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
