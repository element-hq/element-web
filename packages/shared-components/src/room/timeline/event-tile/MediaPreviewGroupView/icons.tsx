import { MediaPreviewIcon } from "./MediaPreviewGroupView";
import FileIcon from "@vector-im/compound-design-tokens/assets/web/icons/document";
import React from "react";

export type ThemeType = "light" | "dark";

export function attachmentIconOfType(theme: ThemeType, mimeType?: string): MediaPreviewIcon {
    switch (mimeType) {
        case "application/pdf":
            return pdfIcon(theme);
        default:
            return attachmentIcon(theme);
    }
}

export function attachmentIcon(theme: ThemeType): MediaPreviewIcon {
    if (theme === "light") {
        return {
            icon: <FileIcon />,
            color: "#4200A6",
        };
    } else {
        return {
            icon: <FileIcon />,
            color: "#4200A6",
        };
    }
}

export function pdfIcon(theme: ThemeType): MediaPreviewIcon {
    if (theme === "light") {
        return {
            icon: <FileIcon />,
            color: "#D51928",
        };
    } else {
        return {
            icon: <FileIcon />,
            color: "#D51928",
        };
    }
}
