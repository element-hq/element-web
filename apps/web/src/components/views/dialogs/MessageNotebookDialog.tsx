/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useState } from "react";
import { AttachmentIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import BaseDialog from "./BaseDialog";
import AccessibleButton from "../elements/AccessibleButton";

interface Props {
    onFinished: () => void;
    onSend: (file: File) => Promise<void>;
}

/** Send long-form notes as .txt attachments, preserving Element's reply/thread upload path. */
const MessageNotebookDialog: React.FC<Props> = ({ onFinished, onSend }) => {
    const [name, setName] = useState("聊天记事本.txt");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string>();
    const submit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        if (!body.trim() || sending) return;
        setSending(true);
        setError(undefined);
        try {
            const filename = name.trim().endsWith(".txt") ? name.trim() : `${name.trim() || "聊天记事本"}.txt`;
            await onSend(new File([body], filename, { type: "text/plain" }));
            onFinished();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "记事本文件发送失败，请重试。");
        } finally {
            setSending(false);
        }
    };
    return (
        <BaseDialog title="聊天记事本" onFinished={onFinished} contentId="mx_MessageNotebookDialog">
            <form id="mx_MessageNotebookDialog" onSubmit={submit}>
                <div className="mx_MessageNotebookDialog_intro">
                    <span className="mx_MessageNotebookDialog_icon" aria-hidden="true">
                        <AttachmentIcon />
                    </span>
                    <p>将长内容作为可命名的 .txt 附件发送；回复和线程关系会随附件一起发送。</p>
                </div>
                <label className="mx_MessageNotebookDialog_field">
                    <span>文件名</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} aria-label="文件名" />
                </label>
                <label className="mx_MessageNotebookDialog_field">
                    <span>内容</span>
                    <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        aria-label="记事本内容"
                        rows={12}
                        autoFocus
                    />
                </label>
                {error && (
                    <p className="mx_MessageNotebookDialog_error" role="alert">
                        {error}
                    </p>
                )}
                <div className="mx_MessageNotebookDialog_actions">
                    <AccessibleButton
                        element="button"
                        kind="secondary"
                        type="button"
                        onClick={onFinished}
                        disabled={sending}
                    >
                        取消
                    </AccessibleButton>
                    <AccessibleButton
                        element="button"
                        kind="primary"
                        type="submit"
                        onClick={() => undefined}
                        disabled={!body.trim() || sending}
                    >
                        {sending ? "正在发送…" : "发送 .txt 文件"}
                    </AccessibleButton>
                </div>
            </form>
        </BaseDialog>
    );
};

export default MessageNotebookDialog;
