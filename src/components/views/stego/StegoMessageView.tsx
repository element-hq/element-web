/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Displays a decoded steganographic message with expiry countdown
 * and visual indicators for stego messages.
 */

import React, { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { StegoCodec } from "../../../steganography/StegoCodec";
import { StegoStrategy } from "../../../steganography/types";
import { getEphemeralManager } from "../../../steganography/ephemeral/EphemeralManager";

/** Props for StegoMessageView. */
interface StegoMessageViewProps {
    /** The carrier content (emoji string or image data URL). */
    carrier: string;
    /** Matrix event ID for tracking. */
    eventId: string;
    /** Room ID the event belongs to. */
    roomId: string;
    /** Optional: decrypt function (defaults to UTF-8 decode for demo). */
    decrypt?: (encrypted: Uint8Array) => Promise<string>;
    /** Whether this message is from the current user. */
    isSelf?: boolean;
}

/** Format remaining time as a human-readable string. */
function formatRemainingTime(ms: number): string {
    if (ms <= 0) return "Expired";

    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
}

/**
 * Renders a decoded steganographic message with:
 *   - Decrypted plaintext
 *   - Expiry countdown timer
 *   - Strategy indicator icon
 *   - Visual styling to distinguish stego messages
 */
export const StegoMessageView: React.FC<StegoMessageViewProps> = ({
    carrier,
    eventId,
    roomId,
    decrypt,
    isSelf = false,
}): JSX.Element => {
    const [plaintext, setPlaintext] = useState<string | null>(null);
    const [decoding, setDecoding] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [strategy, setStrategy] = useState<StegoStrategy | null>(null);
    const [revealed, setRevealed] = useState(false);

    const codec = useMemo(() => new StegoCodec(), []);
    const ephemeral = useMemo(() => getEphemeralManager(), []);

    /** Default decrypt: UTF-8 decode. */
    const defaultDecrypt = useCallback(async (encrypted: Uint8Array): Promise<string> => {
        return new TextDecoder().decode(encrypted);
    }, []);

    const decryptFn = decrypt ?? defaultDecrypt;

    // Decode the carrier on mount
    useEffect(() => {
        let cancelled = false;

        async function decode(): Promise<void> {
            try {
                const result = await codec.decode(carrier);
                if (cancelled) return;

                if (!result) {
                    setError("Could not decode stego message");
                    setDecoding(false);
                    return;
                }

                const { payload, header } = result;

                if (header.expired) {
                    setExpired(true);
                    setDecoding(false);
                    return;
                }

                setStrategy(header.header.strategy);

                const text = await decryptFn(payload);
                if (cancelled) return;

                setPlaintext(text);
                setRemainingTime(Math.max(0, header.header.expiresAt - Date.now()));

                // Track with ephemeral manager
                ephemeral.track(eventId, roomId, header.header.expiresAt);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Decode failed");
                }
            } finally {
                if (!cancelled) setDecoding(false);
            }
        }

        void decode();
        return () => {
            cancelled = true;
        };
    }, [carrier, codec, decryptFn, ephemeral, eventId, roomId]);

    // Update countdown timer
    useEffect(() => {
        if (remainingTime <= 0) return;

        const interval = setInterval(() => {
            setRemainingTime((prev) => {
                const next = prev - 60_000;
                if (next <= 0) {
                    setExpired(true);
                    return 0;
                }
                return next;
            });
        }, 60_000);

        return () => clearInterval(interval);
    }, [remainingTime]);

    // Mark as read when revealed
    const handleReveal = useCallback(() => {
        setRevealed(true);
        ephemeral.markRead(eventId);
    }, [ephemeral, eventId]);

    /** Get the strategy icon. */
    const strategyIcon = useMemo(() => {
        switch (strategy) {
            case StegoStrategy.Emoji:
                return "\u{1F510}"; // locked with key
            case StegoStrategy.EmojiString:
                return "\u{1F511}"; // key
            case StegoStrategy.Image:
                return "\u{1F5BC}"; // framed picture
            default:
                return "\u{1F512}"; // locked
        }
    }, [strategy]);

    // Expired state
    if (expired) {
        return (
            <div className="mx_StegoMessage mx_StegoMessage--expired">
                <span className="mx_StegoMessage_icon">{"\u{1F4A8}"}</span>
                <span className="mx_StegoMessage_text">This message has expired</span>
            </div>
        );
    }

    // Loading state
    if (decoding) {
        return (
            <div className="mx_StegoMessage mx_StegoMessage--loading">
                <span className="mx_StegoMessage_icon">{"\u{1F50D}"}</span>
                <span className="mx_StegoMessage_text">Decoding steganographic message...</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="mx_StegoMessage mx_StegoMessage--error">
                <span className="mx_StegoMessage_icon">{"\u{26A0}"}</span>
                <span className="mx_StegoMessage_text">Failed to decode: {error}</span>
            </div>
        );
    }

    // Unrevealed state — tap to reveal
    if (!revealed && !isSelf) {
        return (
            <div
                className="mx_StegoMessage mx_StegoMessage--hidden"
                onClick={handleReveal}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleReveal();
                }}
                aria-label="Reveal hidden steganographic message"
            >
                <span className="mx_StegoMessage_icon">{strategyIcon}</span>
                <span className="mx_StegoMessage_text">
                    Hidden message — tap to reveal
                </span>
                <span className="mx_StegoMessage_timer">
                    {formatRemainingTime(remainingTime)}
                </span>
            </div>
        );
    }

    // Revealed message
    return (
        <div className={`mx_StegoMessage mx_StegoMessage--revealed ${isSelf ? "mx_StegoMessage--self" : ""}`}>
            <div className="mx_StegoMessage_header">
                <span className="mx_StegoMessage_icon">{strategyIcon}</span>
                <span className="mx_StegoMessage_badge">Stego</span>
                <span className="mx_StegoMessage_timer">
                    {formatRemainingTime(remainingTime)}
                </span>
            </div>
            <div className="mx_StegoMessage_content">
                {plaintext}
            </div>
        </div>
    );
};

export default StegoMessageView;
