/*
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

import React from 'react';
import classNames from 'classnames';
import DiffMatchPatch from 'diff-match-patch';
import {DiffDOM} from "diff-dom";
import { checkBlockNode, bodyToHtml } from "../HtmlUtils";

const decodeEntities = (function() {
    let textarea = null;
    return function(string) {
        if (!textarea) {
            textarea = document.createElement("textarea");
        }
        textarea.innerHTML = string;
        return textarea.value;
    };
})();

function textToHtml(text) {
    const container = document.createElement("div");
    container.textContent = text;
    return container.innerHTML;
}

function getSanitizedHtmlBody(content) {
    const opts = {
        stripReplyFallback: true,
        returnString: true,
    };
    if (content.format === "org.matrix.custom.html") {
        return bodyToHtml(content, null, opts);
    } else {
        // convert the string to something that can be safely
        // embedded in an html document, e.g. use html entities where needed
        // This is also needed so that DiffDOM wouldn't interpret something
        // as a tag when somebody types e.g. "</sarcasm>"

        // as opposed to bodyToHtml, here we also render
        // text messages with dangerouslySetInnerHTML, to unify
        // the code paths and because we need html to show differences
        return textToHtml(bodyToHtml(content, null, opts));
    }
}

function wrapInsertion(child) {
    const wrapper = document.createElement(checkBlockNode(child) ? "div" : "span");
    wrapper.className = "mx_EditHistoryMessage_insertion";
    wrapper.appendChild(child);
    return wrapper;
}

function wrapDeletion(child) {
    const wrapper = document.createElement(checkBlockNode(child) ? "div" : "span");
    wrapper.className = "mx_EditHistoryMessage_deletion";
    wrapper.appendChild(child);
    return wrapper;
}

function findRefNodes(root, route, isAddition) {
    let refNode = root;
    let refParentNode;
    const end = isAddition ? route.length - 1 : route.length;
    for (let i = 0; i < end; ++i) {
        refParentNode = refNode;
        refNode = refNode.childNodes[route[i]];
    }
    return {refNode, refParentNode};
}

function diffTreeToDOM(desc) {
    if (desc.nodeName === "#text") {
        return stringAsTextNode(desc.data);
    } else {
        const node = document.createElement(desc.nodeName);
        if (desc.attributes) {
            for (const [key, value] of Object.entries(desc.attributes)) {
                node.setAttribute(key, value);
            }
        }
        if (desc.childNodes) {
            for (const childDesc of desc.childNodes) {
                node.appendChild(diffTreeToDOM(childDesc));
            }
        }
        return node;
    }
}

function insertBefore(parent, nextSibling, child) {
    if (nextSibling) {
        parent.insertBefore(child, nextSibling);
    } else {
        parent.appendChild(child);
    }
}

function isRouteOfNextSibling(route1, route2) {
    // routes are arrays with indices,
    // to be interpreted as a path in the dom tree

    // ensure same parent
    for (let i = 0; i < route1.length - 1; ++i) {
        if (route1[i] !== route2[i]) {
            return false;
        }
    }
    // the route2 is only affected by the diff of route1
    // inserting an element if the index at the level of the
    // last element of route1 being larger
    // (e.g. coming behind route1 at that level)
    const lastD1Idx = route1.length - 1;
    return route2[lastD1Idx] >= route1[lastD1Idx];
}

function adjustRoutes(diff, remainingDiffs) {
    if (diff.action === "removeTextElement" || diff.action === "removeElement") {
        // as removed text is not removed from the html, but marked as deleted,
        // we need to readjust indices that assume the current node has been removed.
        const advance = 1;
        for (const rd of remainingDiffs) {
            if (isRouteOfNextSibling(diff.route, rd.route)) {
                rd.route[diff.route.length - 1] += advance;
            }
        }
    }
}

function stringAsTextNode(string) {
    return document.createTextNode(decodeEntities(string));
}

function renderDifferenceInDOM(originalRootNode, diff, diffMathPatch) {
    const {refNode, refParentNode} = findRefNodes(originalRootNode, diff.route);
    switch (diff.action) {
        case "replaceElement": {
            const container = document.createElement("span");
            const delNode = wrapDeletion(diffTreeToDOM(diff.oldValue));
            const insNode = wrapInsertion(diffTreeToDOM(diff.newValue));
            container.appendChild(delNode);
            container.appendChild(insNode);
            refNode.parentNode.replaceChild(container, refNode);
            break;
        }
        case "removeTextElement": {
            const delNode = wrapDeletion(stringAsTextNode(diff.value));
            refNode.parentNode.replaceChild(delNode, refNode);
            break;
        }
        case "removeElement": {
            const delNode = wrapDeletion(diffTreeToDOM(diff.element));
            refNode.parentNode.replaceChild(delNode, refNode);
            break;
        }
        case "modifyTextElement": {
            const textDiffs = diffMathPatch.diff_main(diff.oldValue, diff.newValue);
            diffMathPatch.diff_cleanupSemantic(textDiffs);
            const container = document.createElement("span");
            for (const [modifier, text] of textDiffs) {
                let textDiffNode = stringAsTextNode(text);
                if (modifier < 0) {
                    textDiffNode = wrapDeletion(textDiffNode);
                } else if (modifier > 0) {
                    textDiffNode = wrapInsertion(textDiffNode);
                }
                container.appendChild(textDiffNode);
            }
            refNode.parentNode.replaceChild(container, refNode);
            break;
        }
        case "addElement": {
            const insNode = wrapInsertion(diffTreeToDOM(diff.element));
            insertBefore(refParentNode, refNode, insNode);
            break;
        }
        case "addTextElement": {
            // XXX: sometimes diffDOM says insert a newline when there shouldn't be one
            // but we must insert the node anyway so that we don't break the route child IDs.
            // See https://github.com/fiduswriter/diffDOM/issues/100
            const insNode = wrapInsertion(stringAsTextNode(diff.value !== "\n" ? diff.value : ""));
            insertBefore(refParentNode, refNode, insNode);
            break;
        }
        // e.g. when changing a the href of a link,
        // show the link with old href as removed and with the new href as added
        case "removeAttribute":
        case "addAttribute":
        case "modifyAttribute": {
            const delNode = wrapDeletion(refNode.cloneNode(true));
            const updatedNode = refNode.cloneNode(true);
            if (diff.action === "addAttribute" || diff.action === "modifyAttribute") {
                updatedNode.setAttribute(diff.name, diff.newValue);
            } else {
                updatedNode.removeAttribute(diff.name);
            }
            const insNode = wrapInsertion(updatedNode);
            const container = document.createElement(checkBlockNode(refNode) ? "div" : "span");
            container.appendChild(delNode);
            container.appendChild(insNode);
            refNode.parentNode.replaceChild(container, refNode);
            break;
        }
        default:
            // Should not happen (modifyComment, ???)
            console.warn("MessageDiffUtils::editBodyDiffToHtml: diff action not supported atm", diff);
    }
}

function routeIsEqual(r1, r2) {
    return r1.length === r2.length && !r1.some((e, i) => e !== r2[i]);
}

// workaround for https://github.com/fiduswriter/diffDOM/issues/90
function filterCancelingOutDiffs(originalDiffActions) {
    const diffActions = originalDiffActions.slice();

    for (let i = 0; i < diffActions.length; ++i) {
        const diff = diffActions[i];
        if (diff.action === "removeTextElement") {
            const nextDiff = diffActions[i + 1];
            const cancelsOut = nextDiff &&
                nextDiff.action === "addTextElement" &&
                nextDiff.text === diff.text &&
                routeIsEqual(nextDiff.route, diff.route);

            if (cancelsOut) {
                diffActions.splice(i, 2);
            }
        }
    }

    return diffActions;
}

/**
 * Renders a message with the changes made in an edit shown visually.
 * @param {object} originalContent the content for the base message
 * @param {object} editContent the content for the edit message
 * @return {object} a react element similar to what `bodyToHtml` returns
 */
export function editBodyDiffToHtml(originalContent, editContent) {
    // wrap the body in a div, DiffDOM needs a root element
    const originalBody = `<div>${getSanitizedHtmlBody(originalContent)}</div>`;
    const editBody = `<div>${getSanitizedHtmlBody(editContent)}</div>`;
    const dd = new DiffDOM();
    // diffActions is an array of objects with at least a `action` and `route`
    // property. `action` tells us what the diff object changes, and `route` where.
    // `route` is a path on the DOM tree expressed as an array of indices.
    const originaldiffActions = dd.diff(originalBody, editBody);
    // work around https://github.com/fiduswriter/diffDOM/issues/90
    const diffActions = filterCancelingOutDiffs(originaldiffActions);
    // for diffing text fragments
    const diffMathPatch = new DiffMatchPatch();
    // parse the base html message as a DOM tree, to which we'll apply the differences found.
    // fish out the div in which we wrapped the messages above with children[0].
    const originalRootNode = new DOMParser().parseFromString(originalBody, "text/html").body.children[0];
    for (let i = 0; i < diffActions.length; ++i) {
        const diff = diffActions[i];
        renderDifferenceInDOM(originalRootNode, diff, diffMathPatch);
        // DiffDOM assumes in subsequent diffs route path that
        // the action was applied (e.g. that a removeElement action removed the element).
        // This is not the case for us. We render differences in the DOM tree, and don't apply them.
        // So we need to adjust the routes of the remaining diffs to account for this.
        adjustRoutes(diff, diffActions.slice(i + 1));
    }
    // take the html out of the modified DOM tree again
    const safeBody = originalRootNode.innerHTML;
    const className = classNames({
        'mx_EventTile_body': true,
        'markdown-body': true,
    });
    return <span key="body" className={className} dangerouslySetInnerHTML={{ __html: safeBody }} dir="auto" />;
}
