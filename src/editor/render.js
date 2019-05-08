/*
Copyright 2019 New Vector Ltd

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

export function rerenderModel(editor, model) {
    while (editor.firstChild) {
        editor.removeChild(editor.firstChild);
    }
    for (const part of model.parts) {
        editor.appendChild(part.toDOMNode());
    }
}

export function renderModel(editor, model) {
    // remove unwanted nodes, like <br>s
    for (let i = 0; i < model.parts.length; ++i) {
        const part = model.parts[i];
        let node = editor.childNodes[i];
        while (node && !part.canUpdateDOMNode(node)) {
            editor.removeChild(node);
            node = editor.childNodes[i];
        }
    }
    for (let i = 0; i < model.parts.length; ++i) {
        const part = model.parts[i];
        const node = editor.childNodes[i];
        if (node && part) {
            part.updateDOMNode(node);
        } else if (part) {
            editor.appendChild(part.toDOMNode());
        } else if (node) {
            editor.removeChild(node);
        }
    }
    let surplusElementCount = Math.max(0, editor.childNodes.length - model.parts.length);
    while (surplusElementCount) {
        editor.removeChild(editor.lastChild);
        --surplusElementCount;
    }
}
