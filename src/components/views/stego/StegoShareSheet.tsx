/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Cross-platform sharing component for steganographic messages.
 *
 * Allows users to copy emoji strings or share stego images to external
 * platforms (iMessage, WhatsApp, Twitter, Discord, email, etc.).
 * The encoded carrier looks like normal emoji/images to outsiders.
 */

import React, { useCallback, useState, type JSX } from "react";

import { StegoStrategy } from "../../../steganography/types";

/** Props for StegoShareSheet. */
interface StegoShareSheetProps {
    /** The steganographic carrier to share. */
    carrier: string;
    /** The encoding strategy used. */
    strategy: StegoStrategy;
    /** Callback when the share sheet is closed. */
    onClose: () => void;
}

/** Represents an external sharing target. */
interface ShareTarget {
    id: string;
    name: string;
    icon: string;
    available: boolean;
}

/** Available sharing targets. */
const SHARE_TARGETS: ShareTarget[] = [
    { id: "clipboard", name: "Copy to Clipboard", icon: "\u{1F4CB}", available: true },
    { id: "native", name: "Share...", icon: "\u{1F4E4}", available: typeof navigator !== "undefined" && "share" in navigator },
    { id: "download", name: "Download Image", icon: "\u{1F4BE}", available: true },
];

/**
 * Share sheet for distributing steganographic carriers across platforms.
 *
 * For emoji strategies: copies the emoji string to clipboard or uses Web Share API.
 * For image strategies: downloads the PNG or shares via native share.
 */
export const StegoShareSheet: React.FC<StegoShareSheetProps> = ({
    carrier,
    strategy,
    onClose,
}): JSX.Element => {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isImage = strategy === StegoStrategy.Image;

    /** Copy emoji string to clipboard. */
    const handleCopy = useCallback(async () => {
        try {
            if (isImage) {
                // Convert data URL to blob and copy as image
                const response = await fetch(carrier);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob }),
                ]);
            } else {
                await navigator.clipboard.writeText(carrier);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("Failed to copy to clipboard");
        }
    }, [carrier, isImage]);

    /** Use Web Share API for native sharing. */
    const handleNativeShare = useCallback(async () => {
        try {
            if (isImage) {
                const response = await fetch(carrier);
                const blob = await response.blob();
                const file = new File([blob], "image.png", { type: "image/png" });
                await navigator.share({ files: [file] });
            } else {
                await navigator.share({ text: carrier });
            }
        } catch (err) {
            // User cancelled or share failed
            if (err instanceof Error && err.name !== "AbortError") {
                setError("Share failed");
            }
        }
    }, [carrier, isImage]);

    /** Download stego image as PNG file. */
    const handleDownload = useCallback(() => {
        if (!isImage) return;

        const link = document.createElement("a");
        link.href = carrier;
        link.download = `stego_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [carrier, isImage]);

    /** Handle a share target click. */
    const handleShare = useCallback(
        async (targetId: string) => {
            setError(null);
            switch (targetId) {
                case "clipboard":
                    await handleCopy();
                    break;
                case "native":
                    await handleNativeShare();
                    break;
                case "download":
                    handleDownload();
                    break;
            }
        },
        [handleCopy, handleNativeShare, handleDownload],
    );

    /** Filter targets based on strategy. */
    const availableTargets = SHARE_TARGETS.filter((target) => {
        if (!target.available) return false;
        if (target.id === "download" && !isImage) return false;
        return true;
    });

    return (
        <div className="mx_StegoShareSheet">
            <div className="mx_StegoShareSheet_header">
                <h3>Share Stego Message</h3>
                <button
                    className="mx_StegoShareSheet_close"
                    onClick={onClose}
                    aria-label="Close share sheet"
                >
                    {"\u2715"}
                </button>
            </div>

            <div className="mx_StegoShareSheet_preview">
                {isImage ? (
                    <img
                        src={carrier}
                        alt="Steganographic image"
                        className="mx_StegoShareSheet_previewImage"
                    />
                ) : (
                    <div className="mx_StegoShareSheet_previewEmoji">
                        <p className="mx_StegoShareSheet_previewLabel">
                            This emoji sequence contains a hidden message:
                        </p>
                        <div className="mx_StegoShareSheet_emojiContent">
                            {carrier.length > 100 ? carrier.substring(0, 100) + "..." : carrier}
                        </div>
                    </div>
                )}
            </div>

            <div className="mx_StegoShareSheet_info">
                <p>
                    {isImage
                        ? "Share this image anywhere. Only someone with the app can decode the hidden message."
                        : "Copy and paste these emojis anywhere. Only someone with the app can read the hidden message."}
                </p>
            </div>

            <div className="mx_StegoShareSheet_targets">
                {availableTargets.map((target) => (
                    <button
                        key={target.id}
                        className="mx_StegoShareSheet_target"
                        onClick={() => void handleShare(target.id)}
                        aria-label={target.name}
                    >
                        <span className="mx_StegoShareSheet_targetIcon">{target.icon}</span>
                        <span className="mx_StegoShareSheet_targetName">
                            {target.id === "clipboard" && copied ? "Copied!" : target.name}
                        </span>
                    </button>
                ))}
            </div>

            {error && <div className="mx_StegoShareSheet_error">{error}</div>}

            <div className="mx_StegoShareSheet_footer">
                <p className="mx_StegoShareSheet_footerNote">
                    Message will self-destruct after the set expiry time.
                </p>
            </div>
        </div>
    );
};

export default StegoShareSheet;
