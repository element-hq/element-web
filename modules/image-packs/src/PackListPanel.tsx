/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, useState } from "react";

import type { ImagePackMediaUrl, UseImagePacksResult } from "./useImagePacks.ts";
import type { EmoteDefinition, ImagePackDefinition, ImagePackView } from "./types.ts";

interface PackListPanelProps {
    api: UseImagePacksResult;
    /** When provided, only packs for this room id are listed. */
    restrictToRoomId?: string;
    /** Hide personal/user-scope rows. */
    hideUserScope?: boolean;
    /** Show controls for global enable/disable. */
    showGlobalToggle?: boolean;
    /** Limit the list to personal/global references. */
    onlyUserScope?: boolean;
    /** Show the room state-key creation form. */
    allowCreateRoomPack?: boolean;
    /** Show the personal account-data creation form when no personal pack exists. */
    allowCreateUserPack?: boolean;
}

function isValidShortcode(value: string): boolean {
    return /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function isValidStateKey(value: string): boolean {
    return isValidShortcode(value) && value !== "_order";
}

function isValidMxc(value: string): boolean {
    return /^mxc:\/\/[^\s/]+\/[^\s]+$/.test(value);
}

export function PackListPanel(props: PackListPanelProps): React.ReactElement {
    const {
        api,
        restrictToRoomId,
        hideUserScope,
        showGlobalToggle,
        onlyUserScope,
        allowCreateRoomPack,
        allowCreateUserPack,
    } = props;
    const [query, setQuery] = useState("");
    const visible = api.packs.filter((pack) => {
        if (hideUserScope && pack.scope === "user") return false;
        if (onlyUserScope && pack.scope !== "user") return false;
        if (restrictToRoomId && pack.roomId !== restrictToRoomId) return false;
        return true;
    });
    const normalizedQuery = query.trim().toLowerCase();
    const canCreateUserPack = allowCreateUserPack && !api.packs.some((pack) => pack.kind === "personal");
    const filtered = visible.filter((pack) => {
        if (!normalizedQuery) return true;
        return [pack.displayName, pack.stateKey, pack.kind, ...Object.keys(pack.pack.images)].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
        );
    });

    return (
        <div data-testid="image-packs-panel" className="mx_ImagePacksPanel">
            {api.error ? (
                <div className="mx_ImagePacksPanel_error" role="alert">
                    <strong>We couldn’t update your packs.</strong>
                    <span>{api.error}</span>
                </div>
            ) : null}
            {visible.length > 0 ? (
                <div className="mx_ImagePacksPanel_toolbar">
                    <label className="mx_ImagePacksField mx_ImagePacksField_search">
                        <span>Find a pack</span>
                        <input
                            type="search"
                            aria-label="Find a pack"
                            placeholder="Search by name, key, or emote"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    <span className="mx_ImagePacksPanel_resultCount" aria-live="polite">
                        {filtered.length} of {visible.length} {visible.length === 1 ? "pack" : "packs"}
                    </span>
                </div>
            ) : null}
            {visible.length === 0 ? (
                <EmptyState
                    title="No image packs yet."
                    copy="Create a pack here, or add one from a room that already has custom emoji."
                />
            ) : filtered.length === 0 ? (
                <EmptyState title="No packs match that search" copy="Try a different name, key, or emote shortcode." />
            ) : (
                filtered.map((pack) => (
                    <PackCard
                        key={`${pack.roomId}/${pack.stateKey}`}
                        api={api}
                        pack={pack}
                        showGlobalToggle={showGlobalToggle}
                    />
                ))
            )}
            {allowCreateRoomPack ? <NewPackCard api={api} restrictToRoomId={restrictToRoomId} /> : null}
            {canCreateUserPack ? <NewUserPackCard api={api} /> : null}
        </div>
    );
}

function EmptyState(props: { title: string; copy: string }): React.ReactElement {
    return (
        <div className="mx_ImagePacksPanel_empty" role="status">
            <span className="mx_ImagePacksPanel_emptyMark" aria-hidden="true">
                ✦
            </span>
            <strong>{props.title}</strong>
            <span>{props.copy}</span>
        </div>
    );
}

function PackCard(props: {
    api: UseImagePacksResult;
    pack: ImagePackView;
    showGlobalToggle?: boolean;
}): React.ReactElement {
    const { api, pack, showGlobalToggle } = props;
    const [editing, setEditing] = useState(false);
    const [showAllEmotes, setShowAllEmotes] = useState(false);
    const [newEmote, setNewEmote] = useState<EmoteDefinition>({ shortcode: "", url: "" });
    const [emoteError, setEmoteError] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emoteCount = Object.keys(pack.pack.images).length;

    const submitEmote = async (): Promise<void> => {
        setEmoteError(null);
        if (!isValidShortcode(newEmote.shortcode)) {
            setEmoteError("Shortcode must be 1-100 characters of letters, digits, hyphens, or underscores.");
            return;
        }
        if (imageFile && !api.uploadImage) {
            setEmoteError("Direct image uploads are not available here. Paste an mxc:// URL instead.");
            return;
        }
        if (imageFile && imageFile.type && !imageFile.type.startsWith("image/")) {
            setEmoteError("Choose an image file.");
            return;
        }
        if (!imageFile && !isValidMxc(newEmote.url)) {
            setEmoteError("Image URL must be an mxc:// URL.");
            return;
        }
        let imageUrl = newEmote.url.trim();
        try {
            if (imageFile) {
                setUploading(true);
                try {
                    imageUrl = await api.uploadImage!(imageFile);
                } catch {
                    setEmoteError("We couldn’t upload that image. Please try again.");
                    return;
                }
            }
            if (!isValidMxc(imageUrl)) {
                setEmoteError("The uploaded file did not return a valid Matrix media URL.");
                return;
            }
            const emote = { ...newEmote, url: imageUrl };
            if (pack.kind === "personal") await api.addUserEmote(emote);
            else await api.addRoomEmote(pack.roomId, pack.stateKey, emote);
            setNewEmote({ shortcode: "", url: "" });
            setImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch {
            // Writer errors are already exposed via api.error.
        } finally {
            setUploading(false);
        }
    };

    return (
        <article
            className="mx_ImagePacksPanel_pack"
            data-testid={pack.kind === "personal" ? "pack-personal" : `pack-${pack.roomId}-${pack.stateKey}`}
        >
            <header className="mx_ImagePacksPanel_packHeader">
                <div className="mx_ImagePacksPanel_packIdentity">
                    <PackMark pack={pack} getImageUrl={api.getImageUrl} />
                    <div>
                        <div className="mx_ImagePacksPanel_packTitle">
                            <h4>{pack.displayName}</h4>
                            <span className={`mx_ImagePacksBadge mx_ImagePacksBadge_${pack.kind}`}>{pack.kind}</span>
                        </div>
                        <p className="mx_ImagePacksPanel_packMeta">
                            {emoteCount} {emoteCount === 1 ? "emote" : "emotes"}
                            {pack.kind === "global" ? " · Available everywhere" : null}
                        </p>
                    </div>
                </div>
                {editing ? (
                    <PackRenameForm
                        initial={pack.displayName}
                        onSave={async (displayName) => {
                            if (pack.kind === "personal") {
                                await api.setUserPack({ ...pack.pack, displayName });
                            } else {
                                await api.renameRoomPack(pack.roomId, pack.stateKey, displayName);
                            }
                        }}
                        onDone={() => setEditing(false)}
                    />
                ) : null}
                <div className="mx_ImagePacksPanel_packActions">
                    {!editing ? (
                        <button
                            type="button"
                            className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                            onClick={() => setEditing(true)}
                        >
                            Rename
                        </button>
                    ) : null}
                    {showGlobalToggle && pack.kind !== "personal" ? (
                        <button
                            type="button"
                            className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                            onClick={() =>
                                pack.kind === "global"
                                    ? api.disablePackGlobally(pack.roomId, pack.stateKey)
                                    : api.enablePackGlobally(pack.roomId, pack.stateKey)
                            }
                        >
                            {pack.kind === "global" ? "Disable globally" : "Enable globally"}
                        </button>
                    ) : null}
                    {pack.kind === "personal" ? (
                        <button
                            type="button"
                            className="mx_ImagePacksButton mx_ImagePacksButton_danger"
                            onClick={() => api.deleteUserPack()}
                        >
                            Delete
                        </button>
                    ) : pack.kind === "room" ? (
                        <button
                            type="button"
                            className="mx_ImagePacksButton mx_ImagePacksButton_danger"
                            onClick={() =>
                                pack.eventId
                                    ? api.redactRoomPack(pack.roomId, pack.eventId)
                                    : api.deleteRoomPack(pack.roomId, pack.stateKey)
                            }
                        >
                            Delete
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                        onClick={() => downloadJson(api.exportPack(pack.pack), `${pack.stateKey}.json`)}
                    >
                        Export
                    </button>
                </div>
            </header>
            <EmoteGrid
                pack={pack.pack}
                getImageUrl={api.getImageUrl}
                showAll={showAllEmotes}
                onToggleShowAll={() => setShowAllEmotes((current) => !current)}
                onEdit={async (shortcode, body) => {
                    const image = pack.pack.images[shortcode];
                    if (!image) return;
                    if (pack.kind === "personal") await api.editUserEmote({ ...image, body });
                    else await api.editRoomEmote(pack.roomId, pack.stateKey, { ...image, body });
                }}
                onRemove={async (shortcode) => {
                    if (pack.kind === "personal") await api.removeUserEmote(shortcode);
                    else await api.removeRoomEmote(pack.roomId, pack.stateKey, shortcode);
                }}
            />
            <form
                className="mx_ImagePacksPanel_emoteForm"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submitEmote();
                }}
            >
                <div className="mx_ImagePacksPanel_formIntro">
                    <strong>Add an emote</strong>
                    <span>Use a Matrix media URL and a short, memorable name.</span>
                </div>
                <div className="mx_ImagePacksPanel_formFields">
                    <label className="mx_ImagePacksField">
                        <span>Shortcode</span>
                        <input
                            aria-label="Shortcode"
                            placeholder="wave"
                            value={newEmote.shortcode}
                            onChange={(e) => setNewEmote({ ...newEmote, shortcode: e.target.value })}
                        />
                    </label>
                    <label className="mx_ImagePacksField mx_ImagePacksField_wide">
                        <span>Image URL {api.uploadImage ? <small>or upload below</small> : null}</span>
                        <input
                            aria-label="Image URL"
                            placeholder="mxc://example.org/media-id"
                            value={newEmote.url}
                            onChange={(e) => {
                                setImageFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                                setNewEmote({ ...newEmote, url: e.target.value });
                            }}
                        />
                    </label>
                    <label className="mx_ImagePacksField">
                        <span>
                            Alt text <small>optional</small>
                        </span>
                        <input
                            aria-label="Body"
                            placeholder="A waving hand"
                            value={newEmote.body ?? ""}
                            onChange={(e) => setNewEmote({ ...newEmote, body: e.target.value })}
                        />
                    </label>
                    <button
                        type="submit"
                        className="mx_ImagePacksButton mx_ImagePacksButton_primary"
                        disabled={uploading}
                    >
                        {uploading ? "Uploading…" : "Add emote"}
                    </button>
                </div>
                {api.uploadImage ? (
                    <div className="mx_ImagePacksPanel_uploadRow">
                        <label className="mx_ImagePacksField mx_ImagePacksPanel_fileField">
                            <span>
                                Upload image <small>optional</small>
                            </span>
                            <input
                                ref={fileInputRef}
                                aria-label="Upload image"
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    setImageFile(file);
                                    if (file) setNewEmote({ ...newEmote, url: "" });
                                }}
                            />
                        </label>
                        <span className="mx_ImagePacksPanel_uploadHint" aria-live="polite">
                            {imageFile
                                ? `${imageFile.name} will be uploaded when you add the emote.`
                                : "Choose a file instead of pasting a URL."}
                        </span>
                    </div>
                ) : null}
                {emoteError ? <span className="mx_ImagePacksPanel_inlineError">{emoteError}</span> : null}
            </form>
        </article>
    );
}

function PackMark({ pack, getImageUrl }: { pack: ImagePackView; getImageUrl?: ImagePackMediaUrl }): React.ReactElement {
    const entries = Object.entries(pack.pack.images).slice(0, 4);
    const tiles = Array.from({ length: 4 }, (_, index) => entries[index]);
    return (
        <span className="mx_ImagePacksPackMark" aria-hidden="true">
            {tiles.map((entry, index) => {
                const [shortcode, image] = entry ?? [];
                return (
                    <MediaThumbnail
                        key={shortcode ?? `placeholder-${index}`}
                        url={image?.url}
                        getImageUrl={getImageUrl}
                        width={40}
                        height={40}
                        fallback={(shortcode ?? `${pack.kind.slice(0, 1)}${index}`).slice(0, 2).toUpperCase()}
                    />
                );
            })}
        </span>
    );
}

function EmoteGrid(props: {
    pack: ImagePackDefinition;
    getImageUrl?: ImagePackMediaUrl;
    showAll: boolean;
    onToggleShowAll: () => void;
    onEdit: (shortcode: string, body: string) => Promise<void>;
    onRemove: (shortcode: string) => Promise<void>;
}): React.ReactElement {
    const [editing, setEditing] = useState<string | null>(null);
    const [editBody, setEditBody] = useState("");
    const allEntries = Object.entries(props.pack.images);
    const previewLimit = 24;
    const entries = props.showAll ? allEntries : allEntries.slice(0, previewLimit);
    if (allEntries.length === 0) {
        return <div className="mx_ImagePacksPanel_emotesEmpty">No emotes yet. Add the first one below.</div>;
    }
    return (
        <div className="mx_ImagePacksPanel_emotesWrap">
            <ul className="mx_ImagePacksPanel_emotes">
                {entries.map(([shortcode, image]) => (
                    <li key={shortcode} className="mx_ImagePacksPanel_emote" data-testid={`emote-${shortcode}`}>
                        <MediaThumbnail
                            className="mx_ImagePacksPanel_emoteMark"
                            url={image.url}
                            getImageUrl={props.getImageUrl}
                            width={40}
                            height={40}
                            fallback={shortcode.slice(0, 2).toUpperCase()}
                        />
                        <div className="mx_ImagePacksPanel_emoteCopy">
                            <code>:{shortcode}:</code>
                            <span>{image.body || "No alt text"}</span>
                        </div>
                        <div className="mx_ImagePacksPanel_emoteActions">
                            {editing === shortcode ? (
                                <>
                                    <input
                                        aria-label={`Body for ${shortcode}`}
                                        value={editBody}
                                        onChange={(event) => setEditBody(event.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="mx_ImagePacksButton mx_ImagePacksButton_secondary"
                                        onClick={async () => {
                                            await props.onEdit(shortcode, editBody);
                                            setEditing(null);
                                        }}
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                                        onClick={() => setEditing(null)}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                                    onClick={() => {
                                        setEditing(shortcode);
                                        setEditBody(image.body ?? "");
                                    }}
                                >
                                    Edit
                                </button>
                            )}
                            <button
                                type="button"
                                className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                                onClick={() => void props.onRemove(shortcode)}
                            >
                                Remove
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            {allEntries.length > previewLimit ? (
                <button
                    type="button"
                    className="mx_ImagePacksButton mx_ImagePacksButton_tertiary mx_ImagePacksPanel_showMore"
                    onClick={props.onToggleShowAll}
                >
                    {props.showAll ? "Show fewer emotes" : `Show all ${allEntries.length} emotes`}
                </button>
            ) : null}
        </div>
    );
}

function MediaThumbnail(props: {
    className?: string;
    url?: string;
    getImageUrl?: ImagePackMediaUrl;
    width: number;
    height: number;
    fallback: string;
}): React.ReactElement {
    const [failedUrl, setFailedUrl] = useState<string>();
    const resolvedUrl =
        props.url && props.getImageUrl ? props.getImageUrl(props.url, props.width, props.height) : undefined;
    const showImage = Boolean(resolvedUrl && resolvedUrl !== failedUrl);

    return (
        <span className={props.className} aria-hidden="true">
            {showImage ? (
                <img
                    src={resolvedUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailedUrl(resolvedUrl)}
                />
            ) : (
                props.fallback
            )}
        </span>
    );
}

function PackRenameForm(props: {
    initial: string;
    onSave: (displayName: string) => Promise<void>;
    onDone: () => void;
}): React.ReactElement {
    const { initial, onSave, onDone } = props;
    const [value, setValue] = useState(initial);
    return (
        <form
            className="mx_ImagePacksPanel_renameForm"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!value.trim()) return;
                await onSave(value.trim());
                onDone();
            }}
        >
            <label className="mx_ImagePacksField">
                <span>Pack name</span>
                <input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Pack name" />
            </label>
            <button type="submit" className="mx_ImagePacksButton mx_ImagePacksButton_secondary">
                Save
            </button>
            <button type="button" className="mx_ImagePacksButton mx_ImagePacksButton_tertiary" onClick={onDone}>
                Cancel
            </button>
        </form>
    );
}

function NewPackCard(props: { api: UseImagePacksResult; restrictToRoomId?: string }): React.ReactElement {
    const { api, restrictToRoomId } = props;
    const [stateKey, setStateKey] = useState("");
    const [displayName, setDisplayName] = useState("");
    const submit = async (): Promise<void> => {
        const roomId = restrictToRoomId ?? api.newPack.roomId;
        if (!isValidStateKey(stateKey) || !displayName.trim() || !roomId) return;
        await api.createRoomPack({
            roomId,
            stateKey,
            displayName,
            usage: ["emoticon"],
            images: {},
        });
        setStateKey("");
        setDisplayName("");
    };
    return (
        <form
            className="mx_ImagePacksPanel_newPack"
            data-testid="new-pack-form"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <div className="mx_ImagePacksPanel_formIntro">
                <strong>New room pack</strong>
                <span>Give the room a tidy name, then add emotes from the pack card.</span>
            </div>
            <div className="mx_ImagePacksPanel_formFields">
                <label className="mx_ImagePacksField">
                    <span>State key</span>
                    <input
                        aria-label="State key"
                        placeholder="state-key (a-z, 0-9, -, _)"
                        value={stateKey}
                        onChange={(e) => setStateKey(e.target.value)}
                    />
                </label>
                <label className="mx_ImagePacksField mx_ImagePacksField_wide">
                    <span>Display name</span>
                    <input
                        aria-label="Display name"
                        placeholder="Display name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />
                </label>
                <button type="submit" className="mx_ImagePacksButton mx_ImagePacksButton_primary">
                    Create pack
                </button>
            </div>
        </form>
    );
}

function NewUserPackCard(props: { api: UseImagePacksResult }): React.ReactElement {
    const { api } = props;
    const [displayName, setDisplayName] = useState("");
    const submit = async (): Promise<void> => {
        if (!displayName.trim()) return;
        await api.createUserPack({ displayName: displayName.trim(), usage: ["emoticon"], images: {} });
        setDisplayName("");
    };
    return (
        <form
            className="mx_ImagePacksPanel_newPack"
            data-testid="new-user-pack-form"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <div className="mx_ImagePacksPanel_formIntro">
                <strong>New personal pack</strong>
                <span>A private collection that follows you between rooms.</span>
            </div>
            <div className="mx_ImagePacksPanel_formFields">
                <label className="mx_ImagePacksField mx_ImagePacksField_wide">
                    <span>Display name</span>
                    <input
                        aria-label="Personal pack display name"
                        placeholder="Display name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                    />
                </label>
                <button type="submit" className="mx_ImagePacksButton mx_ImagePacksButton_primary">
                    Create pack
                </button>
            </div>
        </form>
    );
}

function downloadJson(content: string, filename: string): void {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
