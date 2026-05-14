/*
 * Copyright (C) 2026 Element Creations Ltd
 *
 * SPDX-License-Identifier: LicenseRef-Element-Commercial
 */

import { BigIcon, Checkbox } from "@vector-im/compound-web";
import React, { type MouseEventHandler, useCallback, useId, useEffect, useState, type ReactNode } from "react";
import classNames from "classnames";

import styles from "./GridFileList.module.css";
import type { FileShareNode } from "./Viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";

export type GridFileListPreviewEngine = (fileId: string) => Promise<string | null>;

function DirectoryItem({
    name,
    onClick,
    updatedAt,
    disabled,
}: {
    name: string;
    onClick: () => void;
    updatedAt?: Date;
    disabled?: boolean;
}): ReactNode {
    const i18n = useI18n();
    const id = useId();

    const onTileClick: MouseEventHandler = useCallback(
        (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onClick();
        },
        [onClick],
    );

    return (
        <li>
            <button
                data-kind="primary"
                className={classNames(styles.fileTile)}
                disabled={disabled}
                onClick={onTileClick}
                id={id}
            >
                <BigIcon size="md" className={styles.bigIcon}>
                    <span>🗀</span>
                </BigIcon>
                <div>
                    <label htmlFor={id}>{name}</label>
                    {updatedAt && <span className={styles.timestamp}>{i18n.humanizeTime(updatedAt.getTime())}</span>}
                </div>
            </button>
        </li>
    );
}

function FileItem({
    name,
    fileId,
    updatedAt,
    onChange,
    disabled,
    selected,
    previewEngine,
}: {
    name: string;
    fileId: string;
    updatedAt?: Date;
    onChange: () => void;
    disabled?: boolean;
    selected: boolean;
    previewEngine?: GridFileListPreviewEngine;
}): ReactNode {
    const i18n = useI18n();
    const id = useId();
    const [previewUrl, setPreviewUrl] = useState<string | null>();
    useEffect(() => {
        if (previewEngine) {
            void previewEngine(fileId).then((v) => setPreviewUrl(v));
        }
    }, [fileId, previewEngine]);

    return (
        <li>
            <button
                data-kind="primary"
                className={classNames(styles.fileTile)}
                disabled={disabled}
                onClick={() => onChange()}
                id={id}
                tabIndex={-1}
                /* For keyboard nav, use the checkbox. The button is just a bigger target. */
                aria-hidden
            >
                <div
                    className={classNames(styles.previewThumb)}
                    style={{ backgroundImage: previewUrl ? `url("${previewUrl}")` : undefined }}
                >
                    <Checkbox aria-labelledby={id} checked={selected} />
                </div>
                <div>
                    <label htmlFor={id}>{name}</label>
                    {updatedAt && <span className={styles.timestamp}>{i18n.humanizeTime(updatedAt.getTime())}</span>}
                </div>
            </button>
        </li>
    );
}

export interface GridFileListProps {
    selectedFiles: string[];
    files: Array<FileShareNode>;
    directories: Array<FileShareNode>;
    onFileSelected: (name: string) => void;
    onDirectoryChange: (name: string) => void;
    previewEngine: GridFileListPreviewEngine;
}

export function GridFileListView({
    onDirectoryChange,
    onFileSelected,
    files,
    directories,
    selectedFiles,
    previewEngine,
}: GridFileListProps): ReactNode {
    return (
        <ol className={styles.container}>
            {directories.map((f) => (
                <DirectoryItem
                    key={f.name}
                    updatedAt={f.updatedAt}
                    onClick={() => onDirectoryChange(f.name)}
                    name={f.name}
                />
            ))}
            {files.map((f) => (
                <FileItem
                    key={f.name}
                    name={f.name}
                    fileId={f.id}
                    updatedAt={f.updatedAt}
                    previewEngine={previewEngine}
                    selected={selectedFiles.includes(f.id)}
                    onChange={() => onFileSelected(f.id)}
                />
            ))}
        </ol>
    );
}
