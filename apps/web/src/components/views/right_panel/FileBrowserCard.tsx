/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentType, useEffect, useState } from "react";
import classNames from "classnames";
import {
    ChevronDownIcon,
    ChevronRightIcon,
    CloudIcon,
    DocumentIcon,
    FolderIcon,
    RoomIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { logger } from "matrix-js-sdk/src/logger";

import BaseCard from "./BaseCard";
import { PanelTabs } from "./PanelTabs";
import Spinner from "../elements/Spinner";
import { _t } from "../../../languageHandler";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { listRoomFiles, type RoomFile } from "../../../utils/roomFiles";

/**
 * PROTOTYPE DATA.
 *
 * The storage providers below are not connected to anything; the folders and files are invented
 * so the browsing experience can be reviewed before any integration is scoped. The room source
 * is real — see {@link listRoomFiles}.
 */
interface PrototypeFolder {
    name: string;
    files: string[];
}

interface PrototypeSource {
    id: string;
    name: string;
    Icon: ComponentType<React.SVGAttributes<SVGElement>>;
    folders: PrototypeFolder[];
}

const PROTOTYPE_SOURCES: PrototypeSource[] = [
    {
        id: "nextcloud",
        name: "NextCloud",
        Icon: CloudIcon,
        folders: [
            { name: "Shared with me", files: ["q3-report.pdf", "budget-forecast.pdf"] },
            { name: "Contracts", files: ["msa-signed.pdf", "nda-template.docx"] },
        ],
    },
    {
        id: "onedrive",
        name: "OneDrive",
        Icon: CloudIcon,
        folders: [
            { name: "Documents", files: ["handbook-2026.pdf", "travel-policy.pdf"] },
            { name: "Presentations", files: ["roadmap-review.pdf"] },
        ],
    },
];

const ROOM_SOURCE_ID = "room";

interface Props {
    /** The room whose files are listed under the Room source. */
    roomId?: string;
    onClose: () => void;
}

/**
 * Prototype file browser for the right panel.
 *
 * Shows the current room alongside the storage providers we might connect, so the shape of a
 * cross-source file list can be judged. The room's files are real and flat — a room has no
 * folders to descend into — while the providers are invented folder trees.
 */
export default function FileBrowserCard({ roomId, onClose }: Props): JSX.Element {
    const client = useMatrixClientContext();

    // Everything starts collapsed except the room, which is the source that exists today.
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set([ROOM_SOURCE_ID]));
    const [roomFiles, setRoomFiles] = useState<RoomFile[] | null>(null);

    useEffect(() => {
        if (!roomId) {
            setRoomFiles([]);
            return;
        }

        let cancelled = false;
        setRoomFiles(null);

        listRoomFiles(client, roomId)
            .then((files) => {
                if (!cancelled) setRoomFiles(files);
            })
            .catch((err) => {
                if (cancelled) return;
                logger.error("Failed to list room files", err);
                setRoomFiles([]);
            });

        return () => {
            cancelled = true;
        };
    }, [client, roomId]);

    const toggle = (key: string): void =>
        setExpanded((current) => {
            const next = new Set(current);
            if (!next.delete(key)) next.add(key);
            return next;
        });

    const roomOpen = expanded.has(ROOM_SOURCE_ID);

    return (
        <BaseCard
            className="mx_FileBrowserCard"
            onClose={onClose}
            header={<PanelTabs active={RightPanelPhases.FileBrowser} />}
        >
            <div className="mx_FileBrowserCard_tree" role="tree">
                <div className="mx_FileBrowserCard_source">
                    <TreeRow
                        depth={0}
                        expanded={roomOpen}
                        Icon={RoomIcon}
                        label={_t("right_panel|file_browser|room_source")}
                        onClick={() => toggle(ROOM_SOURCE_ID)}
                    />
                    {roomOpen && <RoomFiles files={roomFiles} />}
                </div>

                {PROTOTYPE_SOURCES.map((source) => {
                    const sourceOpen = expanded.has(source.id);
                    return (
                        <div key={source.id} className="mx_FileBrowserCard_source">
                            <TreeRow
                                depth={0}
                                expanded={sourceOpen}
                                Icon={source.Icon}
                                label={source.name}
                                onClick={() => toggle(source.id)}
                            />
                            {sourceOpen &&
                                source.folders.map((folder) => {
                                    const folderKey = `${source.id}/${folder.name}`;
                                    const folderOpen = expanded.has(folderKey);
                                    return (
                                        <React.Fragment key={folderKey}>
                                            <TreeRow
                                                depth={1}
                                                expanded={folderOpen}
                                                Icon={FolderIcon}
                                                label={folder.name}
                                                onClick={() => toggle(folderKey)}
                                            />
                                            {folderOpen &&
                                                folder.files.map((file) => (
                                                    <TreeRow
                                                        key={`${folderKey}/${file}`}
                                                        depth={2}
                                                        Icon={DocumentIcon}
                                                        label={file}
                                                    />
                                                ))}
                                        </React.Fragment>
                                    );
                                })}
                        </div>
                    );
                })}
            </div>
        </BaseCard>
    );
}

/** The room's attachments: a flat list, since a room has no folder structure. */
function RoomFiles({ files }: { files: RoomFile[] | null }): JSX.Element {
    if (files === null) {
        return (
            <div className="mx_FileBrowserCard_status">
                <Spinner size={20} />
            </div>
        );
    }

    if (files.length === 0) {
        return <div className="mx_FileBrowserCard_status">{_t("right_panel|file_browser|room_empty")}</div>;
    }

    return (
        <>
            {files.map((file) => (
                <TreeRow key={file.eventId} depth={1} Icon={DocumentIcon} label={file.name} />
            ))}
        </>
    );
}

interface TreeRowProps {
    depth: 0 | 1 | 2;
    /** Omitted for leaves, which have nothing to expand. */
    expanded?: boolean;
    Icon: ComponentType<React.SVGAttributes<SVGElement>>;
    label: string;
    onClick?: () => void;
}

/** One row of the tree: a source, a folder, or a file. */
function TreeRow({ depth, expanded, Icon, label, onClick }: TreeRowProps): JSX.Element {
    const isBranch = expanded !== undefined;
    const content = (
        <>
            <span className="mx_FileBrowserCard_twisty" aria-hidden>
                {isBranch ? expanded ? <ChevronDownIcon /> : <ChevronRightIcon /> : null}
            </span>
            <Icon className="mx_FileBrowserCard_icon" aria-hidden />
            <span className="mx_FileBrowserCard_label">{label}</span>
        </>
    );

    const className = classNames("mx_FileBrowserCard_row", `mx_FileBrowserCard_row_depth${depth}`);

    // Files are not actionable yet, so they are plain text rather than a button that does nothing.
    if (!isBranch) {
        return (
            <div className={className} role="treeitem" aria-level={depth + 1}>
                {content}
            </div>
        );
    }

    return (
        <button
            type="button"
            className={className}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={expanded}
            onClick={onClick}
        >
            {content}
        </button>
    );
}
