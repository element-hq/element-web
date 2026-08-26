import { JSX } from "react/jsx-runtime";
import { MediaHandle } from "./file-viewer";

export interface CustomPreviewTileIcon {
    svg: JSX.Element;
    color: string;
}

export interface CustomPreviewTilePatch {
    icon?: CustomPreviewTileIcon;
    header?: string;
    subtext?: string;
}

export interface CustomPreviewTileOptions {
    id: string;
}

export type CustomPreviewTilePatcher = (media: MediaHandle) => Promise<CustomPreviewTilePatch | null>;

export interface CustomPreviewTileApi {
    registerCustomPreviewTilePatcher(patcher: CustomPreviewTilePatcher, opts: CustomPreviewTileOptions): void;
}
