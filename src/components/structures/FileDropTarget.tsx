/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useEffect, useState } from "react";

import { _t } from "../../languageHandler";

interface IProps {
    parent: HTMLElement | null;
    onFileDrop(dataTransfer: DataTransfer): void;
}

interface IState {
    dragging: boolean;
    counter: number;
}

const FileDropTarget: React.FC<IProps> = ({ parent, onFileDrop }) => {
    const [state, setState] = useState<IState>({
        dragging: false,
        counter: 0,
    });

    useEffect(() => {
        if (!parent || parent.ondrop) return;

        const onDragEnter = (ev: DragEvent): void => {
            ev.stopPropagation();
            ev.preventDefault();
            if (!ev.dataTransfer) return;

            setState((state) => ({
                // We always increment the counter no matter the types, because dragging is
                // still happening. If we didn't, the drag counter would get out of sync.
                counter: state.counter + 1,
                // See:
                // https://docs.w3cub.com/dom/datatransfer/types
                // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#file
                dragging:
                    ev.dataTransfer!.types.includes("Files") ||
                    ev.dataTransfer!.types.includes("application/x-moz-file")
                        ? true
                        : state.dragging,
            }));
        };

        const onDragLeave = (ev: DragEvent): void => {
            ev.stopPropagation();
            ev.preventDefault();

            setState((state) => ({
                counter: state.counter - 1,
                dragging: state.counter <= 1 ? false : state.dragging,
            }));
        };

        const onDragOver = (ev: DragEvent): void => {
            ev.stopPropagation();
            ev.preventDefault();
            if (!ev.dataTransfer) return;

            ev.dataTransfer.dropEffect = "none";

            // See:
            // https://docs.w3cub.com/dom/datatransfer/types
            // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#file
            if (ev.dataTransfer.types.includes("Files") || ev.dataTransfer.types.includes("application/x-moz-file")) {
                ev.dataTransfer.dropEffect = "copy";
            }
        };

        const onDrop = (ev: DragEvent): void => {
            ev.stopPropagation();
            ev.preventDefault();
            if (!ev.dataTransfer) return;
            onFileDrop(ev.dataTransfer);

            setState((state) => ({
                dragging: false,
                counter: state.counter - 1,
            }));
        };

        parent?.addEventListener("drop", onDrop);
        parent?.addEventListener("dragover", onDragOver);
        parent?.addEventListener("dragenter", onDragEnter);
        parent?.addEventListener("dragleave", onDragLeave);

        return () => {
            // disconnect the D&D event listeners from the room view. This
            // is really just for hygiene - we're going to be
            // deleted anyway, so it doesn't matter if the event listeners
            // don't get cleaned up.
            parent?.removeEventListener("drop", onDrop);
            parent?.removeEventListener("dragover", onDragOver);
            parent?.removeEventListener("dragenter", onDragEnter);
            parent?.removeEventListener("dragleave", onDragLeave);
        };
    }, [parent, onFileDrop]);

    if (state.dragging) {
        return (
            <div className="mx_FileDropTarget">
                <img
                    src={require("../../../res/img/upload-big.svg").default}
                    className="mx_FileDropTarget_image"
                    alt=""
                />
                {_t("Drop file here to upload")}
            </div>
        );
    }

    return null;
};

export default FileDropTarget;
