/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import React, { useState } from "react";

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
                <input value={name} onChange={(event) => setName(event.target.value)} aria-label="文件名" />
                <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    aria-label="记事本内容"
                    rows={12}
                    autoFocus
                />
                {error && (
                    <p className="mx_MessageNotebookDialog_error" role="alert">
                        {error}
                    </p>
                )}
                <AccessibleButton
                    element="button"
                    kind="primary"
                    type="submit"
                    onClick={() => undefined}
                    disabled={!body.trim() || sending}
                >
                    {sending ? "正在发送…" : "发送 .txt 文件"}
                </AccessibleButton>
            </form>
        </BaseDialog>
    );
};

export default MessageNotebookDialog;
