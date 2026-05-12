/*
 * Copyright (C) 2026 Element Creations Ltd
 *
 * SPDX-License-Identifier: LicenseRef-Element-Commercial
 */

import type { ViewModel } from "../../core/viewmodel";
import { GridFileListPreviewEngine } from "./GridFileList";

export type FileId = string;
export type FileShareViewSetting = "list" | "grid";

export type FileShareNode = { id: FileId; name: string; updatedAt?: Date };

export interface FileShareViewSnapshot {
    currentDirectory: string[];
    selectedFiles: string[];
    files: Array<FileShareNode>;
    directories: Array<FileShareNode>;
    loading: boolean;
    sending: boolean;
    viewSetting: FileShareViewSetting;
}

export interface FileShareActions {
    loadFiles(): Promise<void>;
    setCurrentDirectory(name: string): void;
    goBackDirectory(index?: number): void;
    onFileSelected(name: string): void;
    getThumbnailForFile: GridFileListPreviewEngine;
    setFileViewSetting(preference: FileShareViewSetting): void;
}

export type FileShareViewModel = ViewModel<FileShareViewSnapshot, FileShareActions>;
