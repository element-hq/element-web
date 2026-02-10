/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Steganographic message composer.
 *
 * Allows users to type a message, encrypt it, and embed it into an emoji
 * sequence or image for stealthy transmission. Integrates with the Matrix
 * room composer UI.
 */

import React, { useCallback, useRef, useState, type JSX } from "react";

import { StegoCodec } from "../../../steganography/StegoCodec";
import { StegoStrategy, DEFAULT_STEGO_CONFIG } from "../../../steganography/types";
import { getEphemeralManager } from "../../../steganography/ephemeral/EphemeralManager";

/** Props for the StegoComposer component. */
interface StegoComposerProps {
    /** Room ID to send the stego message in. */
    roomId: string;
    /** Callback to send the encoded carrier as a Matrix message. */
    onSend: (carrier: string, strategy: StegoStrategy) => Promise<string | undefined>;
    /** Callback when the composer is dismissed. */
    onClose: () => void;
    /** Optional: encrypt function (defaults to UTF-8 encoding for demo). */
    encrypt?: (plaintext: string) => Promise<Uint8Array>;
}

/** Strategy display labels. */
const STRATEGY_LABELS: Record<StegoStrategy, string> = {
    [StegoStrategy.Emoji]: "Emoji (short)",
    [StegoStrategy.EmojiString]: "Emoji String (medium)",
    [StegoStrategy.Image]: "Image (large)",
};

/**
 * A composer component for creating steganographic messages.
 *
 * The user types their secret message, selects an encoding strategy,
 * and optionally configures self-destruct and custom expiry.
 */
export const StegoComposer: React.FC<StegoComposerProps> = ({
    roomId,
    onSend,
    onClose,
    encrypt,
}): JSX.Element => {
    const [message, setMessage] = useState("");
    const [strategy, setStrategy] = useState<StegoStrategy>(StegoStrategy.Emoji);
    const [selfDestruct, setSelfDestruct] = useState(false);
    const [expiryHours, setExpiryHours] = useState(72);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const coverImageRef = useRef<HTMLInputElement>(null);
    const codecRef = useRef(new StegoCodec());

    /** Default encrypt function: UTF-8 encode (real impl would use Matrix E2EE). */
    const defaultEncrypt = useCallback(async (plaintext: string): Promise<Uint8Array> => {
        return new TextEncoder().encode(plaintext);
    }, []);

    const encryptFn = encrypt ?? defaultEncrypt;

    /** Handle strategy selection. */
    const handleStrategyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setStrategy(e.target.value as StegoStrategy);
        setPreview(null);
    }, []);

    /** Generate a preview of the encoded message. */
    const handlePreview = useCallback(async () => {
        if (!message.trim()) return;
        setError(null);

        try {
            const encrypted = await encryptFn(message);
            const codec = codecRef.current;

            let coverImage: string | undefined;
            if (strategy === StegoStrategy.Image) {
                // For preview, generate a small placeholder
                coverImage = generatePlaceholderImage(256, 256);
            }

            const result = await codec.encode(encrypted, {
                strategy,
                expiryMs: expiryHours * 60 * 60 * 1000,
                coverImage,
            });

            setPreview(result.carrier);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Encoding failed");
        }
    }, [message, strategy, expiryHours, encryptFn]);

    /** Send the steganographic message. */
    const handleSend = useCallback(async () => {
        if (!message.trim()) return;
        setSending(true);
        setError(null);

        try {
            const encrypted = await encryptFn(message);
            const codec = codecRef.current;

            let coverImage: string | undefined;
            if (strategy === StegoStrategy.Image) {
                const input = coverImageRef.current;
                if (input?.files?.[0]) {
                    coverImage = await readFileAsDataUrl(input.files[0]);
                } else {
                    coverImage = generatePlaceholderImage(512, 512);
                }
            }

            const result = await codec.encode(encrypted, {
                strategy,
                expiryMs: expiryHours * 60 * 60 * 1000,
                coverImage,
            });

            // Send via Matrix
            const eventId = await onSend(result.carrier, strategy);

            // Track for ephemeral deletion
            if (eventId) {
                const ephemeral = getEphemeralManager();
                ephemeral.track(eventId, roomId, result.header.expiresAt, selfDestruct);
            }

            // Reset
            setMessage("");
            setPreview(null);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send stego message");
        } finally {
            setSending(false);
        }
    }, [message, strategy, expiryHours, selfDestruct, roomId, onSend, onClose, encryptFn]);

    return (
        <div className="mx_StegoComposer">
            <div className="mx_StegoComposer_header">
                <h3>Steganographic Message</h3>
                <button
                    className="mx_StegoComposer_close"
                    onClick={onClose}
                    aria-label="Close stego composer"
                >
                    ✕
                </button>
            </div>

            <div className="mx_StegoComposer_body">
                <textarea
                    className="mx_StegoComposer_input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your secret message..."
                    rows={3}
                    disabled={sending}
                    aria-label="Secret message input"
                />

                <div className="mx_StegoComposer_options">
                    <label className="mx_StegoComposer_option">
                        <span>Strategy:</span>
                        <select value={strategy} onChange={handleStrategyChange} disabled={sending}>
                            {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="mx_StegoComposer_option">
                        <span>Expires in:</span>
                        <select
                            value={expiryHours}
                            onChange={(e) => setExpiryHours(Number(e.target.value))}
                            disabled={sending}
                        >
                            <option value={1}>1 hour</option>
                            <option value={6}>6 hours</option>
                            <option value={24}>24 hours</option>
                            <option value={72}>72 hours (default)</option>
                            <option value={168}>1 week</option>
                        </select>
                    </label>

                    <label className="mx_StegoComposer_option mx_StegoComposer_checkbox">
                        <input
                            type="checkbox"
                            checked={selfDestruct}
                            onChange={(e) => setSelfDestruct(e.target.checked)}
                            disabled={sending}
                        />
                        <span>Self-destruct after reading</span>
                    </label>

                    {strategy === StegoStrategy.Image && (
                        <label className="mx_StegoComposer_option">
                            <span>Cover image (optional):</span>
                            <input
                                ref={coverImageRef}
                                type="file"
                                accept="image/png"
                                disabled={sending}
                            />
                        </label>
                    )}
                </div>

                {error && <div className="mx_StegoComposer_error">{error}</div>}

                {preview && (
                    <div className="mx_StegoComposer_preview">
                        <h4>Preview:</h4>
                        {strategy === StegoStrategy.Image ? (
                            <img
                                src={preview}
                                alt="Stego preview"
                                className="mx_StegoComposer_previewImage"
                            />
                        ) : (
                            <div className="mx_StegoComposer_previewEmoji">{preview}</div>
                        )}
                    </div>
                )}
            </div>

            <div className="mx_StegoComposer_actions">
                <button
                    className="mx_StegoComposer_previewBtn"
                    onClick={handlePreview}
                    disabled={sending || !message.trim()}
                >
                    Preview
                </button>
                <button
                    className="mx_StegoComposer_sendBtn"
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                >
                    {sending ? "Encoding..." : "Send Stego"}
                </button>
            </div>
        </div>
    );
};

/** Read a File as a data URL string. */
function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

/** Generate a simple placeholder PNG image as a data URL. */
function generatePlaceholderImage(width: number, height: number): string {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context");

    // Generate a subtle gradient pattern as cover
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#667eea");
    gradient.addColorStop(1, "#764ba2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some noise for a more natural look
    const imageData = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = Math.floor(Math.random() * 10) - 5;
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL("image/png");
}

export default StegoComposer;
