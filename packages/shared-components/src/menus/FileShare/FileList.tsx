/*
 * Copyright (C) 2026 Element Creations Ltd
 *
 * SPDX-License-Identifier: LicenseRef-Element-Commercial
 */

import { GridIcon, ListBulletedIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Breadcrumb, InlineSpinner, Switch } from "@vector-im/compound-web";
import React, { useCallback, type ReactNode } from "react";

import { VerticalFileListView } from "./VerticalFileList";
import { GridFileListView } from "./GridFileList";
import styles from "./FileList.module.css";
import type { FileShareViewModel, FileShareViewSetting } from ".";
import { useViewModel } from "../../core/viewmodel";

export interface FileListProps {
    vm: FileShareViewModel;
}

/**
 * A list of files in a file picker interface.
 */
export function FileListView({ vm }: FileListProps): ReactNode {
    const { files, directories, loading, currentDirectory, selectedFiles, viewSetting } = useViewModel(vm);
    const { setCurrentDirectory, goBackDirectory, onFileSelected, setFileViewSetting } = vm;

    const onPageClick = useCallback(
        (_page: unknown, index: number) => {
            goBackDirectory(index);
        },
        [goBackDirectory],
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Breadcrumb
                    backLabel="Back"
                    onBackClick={() => goBackDirectory()}
                    onPageClick={onPageClick}
                    pages={["All files", ...currentDirectory]}
                />
                <Switch<FileShareViewSetting>
                    name="switcher"
                    value={viewSetting}
                    onChange={(v) => setFileViewSetting(v as FileShareViewSetting)}
                    leftLabel="list"
                    leftIcon={ListBulletedIcon}
                    leftValue="list"
                    rightLabel="Thumbnails"
                    rightIcon={GridIcon}
                    rightValue="grid"
                    size="md"
                />
            </header>
            {loading && <InlineSpinner size={48} className={styles.spinner} />}
            {viewSetting === "list" && (
                <VerticalFileListView
                    files={files}
                    directories={directories}
                    onFileSelected={onFileSelected}
                    selectedFiles={selectedFiles}
                    onDirectoryChange={setCurrentDirectory}
                />
            )}
            {viewSetting === "grid" && (
                <GridFileListView
                    files={files}
                    directories={directories}
                    onFileSelected={onFileSelected}
                    selectedFiles={selectedFiles}
                    onDirectoryChange={setCurrentDirectory}
                    previewEngine={(id) => vm.getThumbnailForFile(id)}
                />
            )}
        </div>
    );
}
