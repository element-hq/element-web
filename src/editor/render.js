/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

export function renderModel(editor, model) {
    const lines = model.parts.reduce((lines, part) => {
        if (part.type === "newline") {
            lines.push([]);
        } else {
            const lastLine = lines[lines.length - 1];
            lastLine.push(part);
        }
        return lines;
    }, [[]]);
    // TODO: refactor this code, DRY it
    lines.forEach((parts, i) => {
        let lineContainer = editor.childNodes[i];
        while (lineContainer && (lineContainer.tagName !== "DIV" || !!lineContainer.className)) {
            editor.removeChild(lineContainer);
            lineContainer = editor.childNodes[i];
        }
        if (!lineContainer) {
            lineContainer = document.createElement("div");
            editor.appendChild(lineContainer);
        }

        if (parts.length) {
            parts.forEach((part, j) => {
                let partNode = lineContainer.childNodes[j];
                while (partNode && !part.canUpdateDOMNode(partNode)) {
                    lineContainer.removeChild(partNode);
                    partNode = lineContainer.childNodes[j];
                }
                if (partNode && part) {
                    part.updateDOMNode(partNode);
                } else if (part) {
                    lineContainer.appendChild(part.toDOMNode());
                }
            });

            let surplusElementCount = Math.max(0, lineContainer.childNodes.length - parts.length);
            while (surplusElementCount) {
                lineContainer.removeChild(lineContainer.lastChild);
                --surplusElementCount;
            }
        } else {
            // empty div needs to have a BR in it to give it height
            let foundBR = false;
            let partNode = lineContainer.firstChild;
            while (partNode) {
                const nextNode = partNode.nextSibling;
                if (!foundBR && partNode.tagName === "BR") {
                    foundBR = true;
                } else {
                    lineContainer.removeChild(partNode);
                }
                partNode = nextNode;
            }
            if (!foundBR) {
                lineContainer.appendChild(document.createElement("br"));
            }
        }

        let surplusElementCount = Math.max(0, editor.childNodes.length - lines.length);
        while (surplusElementCount) {
            editor.removeChild(editor.lastChild);
            --surplusElementCount;
        }
    });
}
