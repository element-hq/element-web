/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";

import type { UseImagePacksResult } from "./useImagePacks.ts";
import {
    fetchDiscoveryPack,
    mergeDiscoveryPackMetadata,
    resolveDiscoverySource,
    type DiscoveryFetcher,
} from "./discovery.ts";
import type { DiscoveryIndex, DiscoveryIndexEntry, DiscoverySource } from "./types.ts";

interface DiscoveryPanelProps {
    api: UseImagePacksResult;
    /** Fetcher override; defaults to the browser's `fetch`. */
    fetcher?: DiscoveryFetcher;
    /** Default room id to install discovered packs into. */
    installRoomId: string;
}

interface BrowsedSource {
    source: DiscoverySource;
    index: DiscoveryIndex;
}

export function DiscoveryPanel(props: DiscoveryPanelProps): React.ReactElement {
    const { api, fetcher, installRoomId } = props;
    const [browsing, setBrowsing] = useState<BrowsedSource | null>(null);
    const [browseError, setBrowseError] = useState<string | null>(null);
    const [installError, setInstallError] = useState<string | null>(null);
    const defaultFetcher: DiscoveryFetcher = fetcher ?? {
        async fetchJson(url) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        },
    };

    return (
        <div data-testid="image-packs-discovery" className="mx_ImagePacksDiscovery">
            <div className="mx_ImagePacksDiscovery_intro">
                <span className="mx_ImagePacksEyebrow">Curated directories</span>
                <p>Browse a directory when you want inspiration, then install a pack into this room.</p>
            </div>
            {browseError ? (
                <div className="mx_ImagePacksPanel_error" role="alert">
                    <strong>We couldn’t browse this source.</strong>
                    <span>{browseError}</span>
                </div>
            ) : null}
            {installError ? (
                <div className="mx_ImagePacksPanel_error" role="alert">
                    <strong>We couldn’t install that pack.</strong>
                    <span>{installError}</span>
                </div>
            ) : null}
            {api.sources.length > 0 ? (
                <ul className="mx_ImagePacksDiscovery_sources">
                    {api.sources.map((source) => (
                        <li key={source.id} data-testid={`source-${source.id}`}>
                            <div className="mx_ImagePacksDiscovery_sourceCopy">
                                <strong>{source.displayName ?? source.url}</strong>
                                <span>{source.url}</span>
                            </div>
                            <div className="mx_ImagePacksDiscovery_sourceActions">
                                <button
                                    type="button"
                                    className="mx_ImagePacksButton mx_ImagePacksButton_secondary"
                                    onClick={async () => {
                                        setBrowseError(null);
                                        try {
                                            const index = await resolveDiscoverySource(source, defaultFetcher);
                                            setBrowsing({ source, index });
                                        } catch (e) {
                                            setBrowseError(e instanceof Error ? e.message : String(e));
                                        }
                                    }}
                                >
                                    Browse
                                </button>
                                <button
                                    type="button"
                                    className="mx_ImagePacksButton mx_ImagePacksButton_tertiary"
                                    onClick={() => api.removeSource(source.id)}
                                >
                                    Remove
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="mx_ImagePacksDiscovery_empty" role="status">
                    <strong>No discovery sources yet.</strong>
                    <span>Add a trusted directory below to browse its packs here.</span>
                </div>
            )}
            <NewSourceForm api={api} />
            {browsing ? (
                <BrowseResult
                    api={api}
                    browsed={browsing}
                    fetcher={defaultFetcher}
                    installRoomId={installRoomId}
                    onError={setInstallError}
                    onClose={() => setBrowsing(null)}
                />
            ) : null}
        </div>
    );
}

function NewSourceForm(props: { api: UseImagePacksResult }): React.ReactElement {
    const { api } = props;
    const [draft, setDraft] = useState<DiscoverySource>({ id: "", url: "" });
    return (
        <form
            className="mx_ImagePacksDiscovery_newSource"
            data-testid="new-source-form"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!draft.id.trim() || !draft.url.trim()) return;
                await api.addSource(draft);
                setDraft({ id: "", url: "" });
            }}
        >
            <div className="mx_ImagePacksPanel_formIntro">
                <strong>Add a discovery source</strong>
                <span>Use a directory’s index URL. Only add sources you trust.</span>
            </div>
            <div className="mx_ImagePacksPanel_formFields">
                <label className="mx_ImagePacksField">
                    <span>Source ID</span>
                    <input
                        aria-label="Source ID"
                        placeholder="my-source"
                        value={draft.id}
                        onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    />
                </label>
                <label className="mx_ImagePacksField mx_ImagePacksField_wide">
                    <span>Source URL</span>
                    <input
                        aria-label="Source URL"
                        placeholder="https://example.com/packs/index.json"
                        value={draft.url}
                        onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    />
                </label>
                <button type="submit" className="mx_ImagePacksButton mx_ImagePacksButton_primary">
                    Add source
                </button>
            </div>
        </form>
    );
}

function BrowseResult(props: {
    api: UseImagePacksResult;
    browsed: BrowsedSource;
    fetcher: DiscoveryFetcher;
    installRoomId: string;
    onError: (msg: string) => void;
    onClose: () => void;
}): React.ReactElement {
    const { api, browsed, fetcher, installRoomId, onError, onClose } = props;
    return (
        <div data-testid="discovery-browse" className="mx_ImagePacksDiscovery_browse">
            <div className="mx_ImagePacksDiscovery_browseHeader">
                <div>
                    <span className="mx_ImagePacksEyebrow">Browse source</span>
                    <h4>{browsed.source.displayName ?? browsed.source.url}</h4>
                </div>
                <button type="button" className="mx_ImagePacksButton mx_ImagePacksButton_tertiary" onClick={onClose}>
                    Close
                </button>
            </div>
            <ul className="mx_ImagePacksDiscovery_results">
                {browsed.index.packs.map((entry) => (
                    <BrowseItem
                        key={entry.id}
                        api={api}
                        entry={entry}
                        fetcher={fetcher}
                        installRoomId={installRoomId}
                        onError={onError}
                    />
                ))}
            </ul>
        </div>
    );
}

function BrowseItem(props: {
    api: UseImagePacksResult;
    entry: DiscoveryIndexEntry;
    fetcher: DiscoveryFetcher;
    installRoomId: string;
    onError: (msg: string) => void;
}): React.ReactElement {
    const { api, entry, fetcher, installRoomId, onError } = props;
    return (
        <li data-testid={`discovery-entry-${entry.id}`}>
            <div>
                <strong>{entry.displayName ?? entry.id}</strong>
                <span>{entry.attribution ?? entry.url}</span>
            </div>
            <button
                type="button"
                className="mx_ImagePacksButton mx_ImagePacksButton_secondary"
                onClick={async () => {
                    try {
                        const pack = await fetchDiscoveryPack(entry, fetcher);
                        await api.importPack(
                            mergeDiscoveryPackMetadata(pack, entry),
                            installRoomId,
                            entry.id,
                            entry.displayName,
                        );
                    } catch (e) {
                        onError(e instanceof Error ? e.message : String(e));
                    }
                }}
            >
                Install
            </button>
        </li>
    );
}
