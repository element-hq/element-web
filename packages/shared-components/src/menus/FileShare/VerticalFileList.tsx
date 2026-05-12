/*
 * Copyright (C) 2026 Element Creations Ltd
 *
 * SPDX-License-Identifier: LicenseRef-Element-Commercial
 */

import { Checkbox } from "@vector-im/compound-web";
import React, { useId, type ReactNode } from "react";
import classNames from "classnames";

import styles from "./VerticalFileList.module.css";
import { useI18n } from "../../core/i18n/i18nContext";
import type { FileShareNode } from "./Viewmodel";

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
    return (
        <li className={classNames(styles.fileRow, styles.fileEntryComponent)}>
            <button
                className={styles.fileEntryComponentName}
                disabled={disabled}
                aria-label="Open directory"
                onClick={() => onClick()}
            >
                <span className={styles.folderIcon}>🗀</span>
                <span>{name}</span>
            </button>
            {updatedAt && <span className={styles.timestamp}>{i18n.humanizeTime(updatedAt.getTime())}</span>}
        </li>
    );
}

function FileItem({
    name,
    updatedAt,
    onChange,
    disabled,
    selected,
}: {
    name: string;
    updatedAt?: Date;
    onChange: () => void;
    disabled?: boolean;
    selected: boolean;
}): ReactNode {
    const id = useId();
    const i18n = useI18n();
    const [fileName, ...fileExt] = name.split(".");
    console.log(name, selected);
    return (
        <li className={classNames(styles.fileRow, styles.fileEntryComponent)}>
            <div className={styles.fileEntryComponentName}>
                <Checkbox checked={selected} id={id} disabled={disabled} onChange={() => onChange()} />
                <div>
                    <label htmlFor={id}>{fileName}</label>
                    {fileExt[0] && <span className={styles.fileEntryNameExtension}>.{fileExt.join(".")}</span>}
                </div>
            </div>
            {updatedAt && <span className={styles.timestamp}>{i18n.humanizeTime(updatedAt.getTime())}</span>}
        </li>
    );
}

export interface VerticalFileListProps {
    selectedFiles: string[];
    files: Array<FileShareNode>;
    directories: Array<FileShareNode>;
    onFileSelected: (name: string) => void;
    onDirectoryChange: (name: string) => void;
}

/**
 * A list of selectable files in a vertical details view.
 */
export function VerticalFileListView({
    onDirectoryChange,
    onFileSelected,
    files,
    directories,
    selectedFiles,
}: VerticalFileListProps): ReactNode {
    return (
        <ol className={styles.container}>
            {directories.map((f) => (
                <DirectoryItem
                    key={f.name}
                    updatedAt={f.updatedAt}
                    onClick={() => onDirectoryChange(f.id)}
                    name={f.name}
                />
            ))}
            {files.map((f) => (
                <FileItem
                    key={f.name}
                    name={f.name}
                    updatedAt={f.updatedAt}
                    selected={selectedFiles.includes(f.id)}
                    onChange={() => onFileSelected(f.id)}
                />
            ))}
        </ol>
    );
}
