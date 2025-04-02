/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useState } from "react";
import classNames from "classnames";
import { type DOMNode, Element as ParserElement, domToReact } from "html-react-parser";
import { textContent, getInnerHTML } from "domutils";

import { useSettingValue } from "../../../hooks/useSettings.ts";
import { CopyTextButton } from "../elements/CopyableText.tsx";

const MAX_HIGHLIGHT_LENGTH = 4096;
const MAX_LINES_BEFORE_COLLAPSE = 5;

interface Props {
    preNode: ParserElement;
}

const ExpandCollapseButton: React.FC<{
    expanded: boolean;
    onClick(): void;
}> = ({ expanded, onClick }) => {
    return (
        <span
            className={classNames("mx_EventTile_button", {
                mx_EventTile_expandButton: !expanded,
                mx_EventTile_collapseButton: expanded,
            })}
            onClick={onClick}
        />
    );
};

const CodeBlock: React.FC<Props> = ({ preNode }) => {
    const enableSyntaxHighlightLanguageDetection = useSettingValue("enableSyntaxHighlightLanguageDetection");
    const showCodeLineNumbers = useSettingValue("showCodeLineNumbers");
    const expandCodeByDefault = useSettingValue("expandCodeByDefault");
    const [expanded, setExpanded] = useState(expandCodeByDefault);

    const text = textContent(preNode);

    let expandCollapseButton: JSX.Element | undefined;
    if (text.split("\n").length >= MAX_LINES_BEFORE_COLLAPSE) {
        expandCollapseButton = (
            <ExpandCollapseButton
                expanded={expanded}
                onClick={() => {
                    setExpanded(!expanded);
                }}
            />
        );
    }

    const innerHTML = getInnerHTML(preNode);
    let lineNumbers: JSX.Element | undefined;
    if (showCodeLineNumbers) {
        // Calculate number of lines in pre
        const number = innerHTML.replace(/\n(<\/code>)?$/, "").split(/\n/).length;
        // Iterate through lines starting with 1 (number of the first line is 1)
        lineNumbers = (
            <span className="mx_EventTile_lineNumbers">
                {Array.from({ length: number }, (_, i) => i + 1).map((i) => (
                    <span key={i}>{i}</span>
                ))}
            </span>
        );
    }

    async function highlightCode(div: HTMLElement | null): Promise<void> {
        const code = div?.getElementsByTagName("code")[0];
        if (!code) return;
        const { default: highlight } = await import("highlight.js");

        if (code.textContent && code.textContent.length > MAX_HIGHLIGHT_LENGTH) {
            console.log(
                `Code block is bigger than highlight limit (${code.textContent.length} > ${MAX_HIGHLIGHT_LENGTH}): not highlighting`,
            );
            return;
        }

        let advertisedLang: string | undefined;
        for (const cl of code.className.split(/\s+/)) {
            if (cl.startsWith("language-")) {
                const maybeLang = cl.split("-", 2)[1];
                if (highlight.getLanguage(maybeLang)) {
                    advertisedLang = maybeLang;
                    break;
                }
            }
        }

        if (advertisedLang) {
            // If the code says what language it is, highlight it in that language
            // We don't use highlightElement here because we can't force language detection
            // off. It should use the one we've found in the CSS class but we'd rather pass
            // it in explicitly to make sure.
            code.innerHTML = highlight.highlight(code.textContent ?? "", { language: advertisedLang }).value;
        } else if (enableSyntaxHighlightLanguageDetection) {
            // User has language detection enabled, so highlight the block with auto-highlighting enabled.
            // We pass highlightjs the text to highlight rather than letting it
            // work on the DOM with highlightElement because that also adds CSS
            // classes to the pre/code element that we don't want (the CSS
            // conflicts with our own).
            code.innerHTML = highlight.highlightAuto(code.textContent ?? "").value;
        }
    }

    function highlightCodeRef(div: HTMLElement | null): void {
        highlightCode(div);
    }

    let content = domToReact(preNode.children as DOMNode[]);

    // Add code element if it's missing since we depend on it
    if (!preNode.children.some((child) => child instanceof ParserElement && child.tagName.toUpperCase() === "CODE")) {
        content = <code>{content}</code>;
    }

    return (
        <div className="mx_EventTile_pre_container">
            <pre
                className={classNames({
                    mx_EventTile_collapsedCodeBlock: !expanded,
                })}
            >
                {lineNumbers}
                <div style={{ display: "contents" }} ref={highlightCodeRef}>
                    {content}
                </div>
            </pre>
            {expandCollapseButton}
            <CopyTextButton
                getTextToCopy={() => text}
                className={classNames("mx_EventTile_button mx_EventTile_copyButton", {
                    mx_EventTile_buttonBottom: !!expandCollapseButton,
                })}
            />
        </div>
    );
};

export default CodeBlock;
