/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type MouseEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import {
    enableGlobalPack,
    getCustomEmotesForRoom,
    hasUserPackEmote,
    isGlobalPackEnabled,
    removeUserPackEmote,
    SHORTCODE_PATTERN,
    SHORTCODE_REGEX,
    subscribeToImagePackChanges,
    upsertUserPackEmote,
    type CustomEmote,
} from "../../../custom-emotes";
import { mediaFromMxc } from "../../../customisations/Media";
import ContextMenu, { aboveLeftOf } from "../../structures/ContextMenu";

const MAX_DISPLAY_STRING_LENGTH = 300;
let activeCustomEmoteClose: (() => void) | undefined;

const truncate = (value: string | undefined): string => {
    if (!value) return "";
    return value.length > MAX_DISPLAY_STRING_LENGTH ? `${value.slice(0, MAX_DISPLAY_STRING_LENGTH - 1)}…` : value;
};

function getRawFormattedBodies(mxEvent: MatrixEvent | undefined): string[] {
    if (!mxEvent) return [];
    const content = mxEvent.getContent() as {
        "formatted_body"?: unknown;
        "m.new_content"?: { formatted_body?: unknown };
    };
    // Edited messages render m.new_content, so inspect it before the original fallback body.
    return [content["m.new_content"]?.formatted_body, content.formatted_body].filter(
        (formattedBody): formattedBody is string => typeof formattedBody === "string",
    );
}

/** Read the original MXC from the event without trusting the sanitized message DOM. */
export function getRawCustomEmoteMxcs(mxEvent: MatrixEvent | undefined, shortcode: string): string[] {
    for (const formattedBody of getRawFormattedBodies(mxEvent)) {
        const mxcs = new Set<string>();
        let hasInvalidSource = false;
        const parsed = new DOMParser().parseFromString(formattedBody, "text/html");
        for (const image of parsed.querySelectorAll<HTMLImageElement>("img[data-mx-emoticon]")) {
            if (image.title !== shortcode) continue;
            const src = image.getAttribute("src");
            if (src?.startsWith("mxc://")) mxcs.add(src);
            else hasInvalidSource = true;
        }

        if (mxcs.size > 0 || hasInvalidSource) {
            return hasInvalidSource ? [] : [...mxcs];
        }
    }

    return [];
}

/**
 * Attribute a click to one MXC when several packs share a shortcode in one message.
 * Falls back to `undefined` (unknown provenance) when the clicked image cannot be matched.
 */
export function resolveRawCustomEmoteMxc(
    mxEvent: MatrixEvent | undefined,
    shortcode: string,
    clickedSrc: string | undefined,
    toHttpSrc: (mxc: string) => string | null,
): string | undefined {
    const rawMxcs = getRawCustomEmoteMxcs(mxEvent, shortcode);
    if (rawMxcs.length === 1) return rawMxcs[0];
    if (rawMxcs.length > 1 && clickedSrc) {
        const matches = rawMxcs.filter((mxc) => mxc === clickedSrc || toHttpSrc(mxc) === clickedSrc);
        if (matches.length === 1) return matches[0];
    }
    return undefined;
}

interface OpenEmote {
    shortcode: string;
    body?: string;
    srcHttp?: string;
    mxcUrl?: string;
    emote?: CustomEmote;
}

export interface CustomEmoteInfoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    mxEvent?: MatrixEvent;
    room?: Room;
}

type Operation = "idle" | "saving" | "saved" | "removing" | "removed" | "error";

function getScopeLabel(source: CustomEmote["pack"]["source"]): string {
    switch (source) {
        case "user":
            return _t("common|private");
        case "global":
            return _t("common|public");
        case "space":
            return _t("common|space");
        case "room":
            return _t("common|room");
    }
}

function PersonalPackAction({
    openEmote,
    client,
    onFinished,
}: {
    openEmote: OpenEmote;
    client: NonNullable<Room["client"]> | undefined;
    onFinished: () => void;
}): JSX.Element {
    const inputId = useId();
    const [shortcode, setShortcode] = useState(openEmote.shortcode);
    const [operation, setOperation] = useState<Operation>("idle");
    const [isInPersonalPack, setIsInPersonalPack] = useState(() =>
        client ? hasUserPackEmote(client, openEmote.shortcode) : false,
    );
    const operationRef = useRef(operation);
    const shortcodeRef = useRef(shortcode);
    const validShortcode = SHORTCODE_REGEX.test(shortcode);
    const hasCollision = isInPersonalPack;
    const hasUnknownMedia = !openEmote.mxcUrl;
    const canWrite = Boolean(client && openEmote.mxcUrl && validShortcode && !hasCollision);

    useEffect(() => {
        if (!client) return;
        setIsInPersonalPack(hasUserPackEmote(client, shortcode));
    }, [client, shortcode]);

    useEffect(() => {
        operationRef.current = operation;
        shortcodeRef.current = shortcode;
    }, [operation, shortcode]);

    useEffect(() => {
        if (!client) return;
        const update = (): void => {
            const currentShortcode = shortcodeRef.current;
            const present = hasUserPackEmote(client, currentShortcode);
            setIsInPersonalPack(present);
            if (operationRef.current === "saving" && present) setOperation("saved");
            if (operationRef.current === "removing" && !present) setOperation("removed");
        };
        return subscribeToImagePackChanges(client, update);
    }, [client]);

    const add = async (): Promise<void> => {
        if (!client || !openEmote.mxcUrl || !validShortcode || hasCollision) return;
        setOperation("saving");
        try {
            await upsertUserPackEmote(client, {
                shortcode,
                url: openEmote.mxcUrl,
                body: openEmote.body,
            });
        } catch {
            setOperation("error");
        }
    };

    const remove = async (): Promise<void> => {
        if (!client) return;
        setOperation("removing");
        try {
            await removeUserPackEmote(client, shortcode);
        } catch {
            setOperation("error");
        }
    };

    return (
        <div className="mx_CustomEmoteInfo_personalPack" dir="auto">
            <label className="mx_CustomEmoteInfo_shortcodeLabel" htmlFor={inputId}>
                {_t("common|name")}
            </label>
            <input
                id={inputId}
                className="mx_CustomEmoteInfo_shortcode"
                value={shortcode}
                onChange={(event) => {
                    setShortcode(event.target.value);
                    setOperation("idle");
                }}
                aria-invalid={!validShortcode || hasCollision}
                pattern={SHORTCODE_PATTERN}
                maxLength={100}
                autoComplete="off"
                disabled={operation === "saving" || operation === "removing"}
            />
            {!validShortcode ? (
                <div className="mx_CustomEmoteInfo_error">{_t("common|custom_emote_name_invalid")}</div>
            ) : null}
            {hasCollision ? (
                <div className="mx_CustomEmoteInfo_error">{_t("common|custom_emote_name_in_use")}</div>
            ) : null}
            {hasUnknownMedia ? (
                <div className="mx_CustomEmoteInfo_error">{_t("common|custom_emote_media_unknown")}</div>
            ) : null}
            {operation === "error" ? (
                <div className="mx_CustomEmoteInfo_error">{_t("common|custom_emote_save_failed")}</div>
            ) : null}
            {operation === "saved" || (isInPersonalPack && operation !== "removing") ? (
                <div className="mx_CustomEmoteInfo_status">{_t("common|saved")}</div>
            ) : null}
            {operation === "removed" ? <div className="mx_CustomEmoteInfo_status">{_t("action|remove")}</div> : null}
            <div className="mx_CustomEmoteInfo_actions">
                <button type="button" onClick={() => void add()} disabled={!canWrite || operation === "saving"}>
                    {operation === "saving"
                        ? _t("common|updating")
                        : `${_t("action|add")} ${_t("common|custom_emotes")}`}
                </button>
                {isInPersonalPack ? (
                    <button
                        type="button"
                        onClick={() => void remove()}
                        disabled={operation === "removing"}
                        aria-label={`${_t("action|remove")} ${shortcode}`}
                    >
                        {_t("action|remove")}
                    </button>
                ) : null}
            </div>
            {operation === "saved" ? (
                <button type="button" className="mx_CustomEmoteInfo_done" onClick={onFinished}>
                    {_t("action|close")}
                </button>
            ) : null}
        </div>
    );
}

function CustomEmoteInfoCard({
    openEmote,
    room,
    anchor,
    onFinished,
}: {
    openEmote: OpenEmote;
    room?: Room;
    anchor: HTMLButtonElement;
    onFinished: () => void;
}): JSX.Element {
    const client = room?.client;
    const pack = openEmote.emote?.pack;
    const packAvatar = pack?.content.pack?.avatar_url;
    let packAvatarUrl: string | null = null;
    if (packAvatar) {
        try {
            packAvatarUrl = mediaFromMxc(packAvatar, client).getThumbnailOfSourceHttp(32, 32, "crop");
        } catch {
            // A malformed pack avatar should not prevent the emote details from opening.
        }
    }
    const [globallyEnabled, setGloballyEnabled] = useState(() =>
        client && pack ? isGlobalPackEnabled(client, { roomId: pack.roomId, stateKey: pack.stateKey }) : false,
    );

    useEffect(() => {
        if (!client || !pack) return;
        const reference = { roomId: pack.roomId, stateKey: pack.stateKey };
        setGloballyEnabled(isGlobalPackEnabled(client, reference));
        return subscribeToImagePackChanges(client, () => {
            setGloballyEnabled(isGlobalPackEnabled(client, reference));
        });
    }, [client, pack]);

    let previewSrc: string | null | undefined = openEmote.srcHttp;
    if (!previewSrc && openEmote.mxcUrl) {
        try {
            previewSrc = mediaFromMxc(openEmote.mxcUrl, client).srcHttp;
        } catch {
            previewSrc = null;
        }
    }
    const packEnabled = pack && (pack.source !== "room" && pack.source !== "space" ? true : globallyEnabled);
    const [enableOperation, setEnableOperation] = useState<Operation>("idle");

    const openSettings = (): void => {
        dis.dispatch({ action: Action.ViewUserSettings, initialTabId: UserTab.ImagePacks });
        onFinished();
    };

    const enablePack = async (): Promise<void> => {
        if (!client || !pack) return;
        setEnableOperation("saving");
        try {
            await enableGlobalPack(client, { roomId: pack.roomId, stateKey: pack.stateKey });
            setEnableOperation("saved");
        } catch {
            // The card remains open so the user can retry after a transient failure.
            setEnableOperation("error");
        }
    };

    return (
        <ContextMenu
            {...aboveLeftOf(anchor.getBoundingClientRect())}
            managed={false}
            focusLock
            role="dialog"
            aria-label={`${_t("common|custom_emotes")}: :${truncate(openEmote.shortcode)}:`}
            hasBackground={false}
            menuClassName="mx_CustomEmoteInfo"
            onFinished={onFinished}
        >
            <div className="mx_CustomEmoteInfo_content" dir="auto">
                <div className="mx_CustomEmoteInfo_focusTarget" tabIndex={-1} aria-hidden="true" />
                {previewSrc ? (
                    <img
                        className="mx_CustomEmoteInfo_preview"
                        src={previewSrc}
                        alt={truncate(openEmote.body || openEmote.shortcode)}
                        width={48}
                        height={48}
                    />
                ) : null}
                <div className="mx_CustomEmoteInfo_shortcode">:{truncate(openEmote.shortcode)}:</div>
                {openEmote.body ? (
                    <div className="mx_CustomEmoteInfo_description" title={truncate(openEmote.body)}>
                        {truncate(openEmote.body)}
                    </div>
                ) : null}
                {pack ? (
                    <div className="mx_CustomEmoteInfo_pack">
                        {packAvatarUrl ? (
                            <img className="mx_CustomEmoteInfo_packAvatar" src={packAvatarUrl} alt="" />
                        ) : (
                            <span className="mx_CustomEmoteInfo_packAvatarPlaceholder" aria-hidden="true">
                                {pack.displayName.slice(0, 1)}
                            </span>
                        )}
                        <div className="mx_CustomEmoteInfo_packDetails">
                            <span className="mx_CustomEmoteInfo_packName" title={truncate(pack.displayName)}>
                                {truncate(pack.displayName)}
                            </span>
                            <span className="mx_CustomEmoteInfo_packScope">{getScopeLabel(pack.source)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="mx_CustomEmoteInfo_unknown">{_t("presence|unknown")}</div>
                )}
                {pack?.content.pack?.attribution ? (
                    <div className="mx_CustomEmoteInfo_attribution" title={truncate(pack.content.pack.attribution)}>
                        {_t("common|credits")}: {truncate(pack.content.pack.attribution)}
                    </div>
                ) : null}
                {pack?.source === "user" ? <div className="mx_CustomEmoteInfo_status">{_t("common|saved")}</div> : null}
                {pack && !packEnabled ? (
                    <button
                        type="button"
                        onClick={() => void enablePack()}
                        disabled={enableOperation === "saving" || enableOperation === "saved"}
                    >
                        {_t("action|enable")} {_t("common|custom_emotes")}
                    </button>
                ) : pack ? (
                    <button type="button" onClick={openSettings}>
                        {_t("action|open")} {_t("common|custom_emotes")}
                    </button>
                ) : (
                    <PersonalPackAction openEmote={openEmote} client={client} onFinished={onFinished} />
                )}
                {enableOperation === "saved" ? (
                    <div className="mx_CustomEmoteInfo_status">{_t("common|saved")}</div>
                ) : null}
                {enableOperation === "error" ? (
                    <div className="mx_CustomEmoteInfo_error">{_t("common|custom_emote_save_failed")}</div>
                ) : null}
            </div>
        </ContextMenu>
    );
}

/** Give inbound emotes a keyboard-accessible trigger without changing their rendered image attributes. */
export function CustomEmoteInfo({ mxEvent, room, ...imageProps }: CustomEmoteInfoProps): JSX.Element {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [openEmote, setOpenEmote] = useState<OpenEmote | undefined>();
    const shortcode = typeof imageProps.title === "string" ? imageProps.title : "";
    const close = useCallback((): void => setOpenEmote(undefined), []);

    useEffect(() => {
        if (!openEmote) return;
        const closeOnViewportChange = (): void => close();
        const closeOnPointerDown = (event: PointerEvent): void => {
            const target = event.target as HTMLElement | null;
            if (triggerRef.current?.contains(target)) return;
            if (target?.closest?.(".mx_CustomEmoteInfo")) return;
            close();
        };
        window.addEventListener("scroll", closeOnViewportChange, true);
        window.addEventListener("resize", closeOnViewportChange);
        document.addEventListener("pointerdown", closeOnPointerDown, true);
        return () => {
            window.removeEventListener("scroll", closeOnViewportChange, true);
            window.removeEventListener("resize", closeOnViewportChange);
            document.removeEventListener("pointerdown", closeOnPointerDown, true);
        };
    }, [close, openEmote]);

    useEffect(() => {
        if (!openEmote) return;
        const previousClose = activeCustomEmoteClose;
        activeCustomEmoteClose = close;
        return () => {
            if (activeCustomEmoteClose === close) activeCustomEmoteClose = previousClose;
        };
    }, [close, openEmote]);

    const onClick = (event: MouseEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        if (openEmote) {
            close();
            return;
        }

        // Keep one card open so a transparent ContextMenu background does not leave stale cards behind.
        activeCustomEmoteClose?.();
        const client = room?.client;
        const toHttpSrc = (mxc: string): string | null => {
            if (!client) return null;
            try {
                return mediaFromMxc(mxc, client).srcHttp;
            } catch {
                // An unresolvable MXC simply cannot disambiguate the click.
                return null;
            }
        };
        // The sanitizer renders emote MXCs as HTTP, so the clicked image source
        // identifies which pack a shared shortcode came from.
        const mxcUrl = resolveRawCustomEmoteMxc(
            mxEvent,
            shortcode,
            typeof imageProps.src === "string" ? imageProps.src : undefined,
            toHttpSrc,
        );
        let emote: CustomEmote | undefined;
        if (room?.client) {
            try {
                const resolved = getCustomEmotesForRoom(room.client, room);
                if (mxcUrl) {
                    emote = resolved.find((candidate) => candidate.shortcode === shortcode && candidate.url === mxcUrl);
                }
            } catch {
                // Rendering the card is still useful when room state is unavailable during a sync transition.
            }
        }
        setOpenEmote({
            shortcode,
            body: imageProps.alt || emote?.body,
            srcHttp: imageProps.src,
            mxcUrl,
            emote,
        });
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className="mx_CustomEmoteInfo_trigger"
                onClick={onClick}
                aria-label={`:${truncate(shortcode)}:`}
                aria-haspopup="dialog"
                aria-expanded={Boolean(openEmote)}
            >
                <img {...imageProps} alt="" aria-hidden="true" />
            </button>
            {openEmote && triggerRef.current ? (
                <CustomEmoteInfoCard openEmote={openEmote} room={room} anchor={triggerRef.current} onFinished={close} />
            ) : null}
        </>
    );
}
