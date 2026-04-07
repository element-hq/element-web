/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import type { Meta, StoryObj } from "@storybook/react-vite";

import styles from "./FigmaPrototypeSandbox.module.css";

type StepData = {
    number: number;
    title: string;
    description: string;
    code?: string;
    prompt?: string;
    action?: { label: string; url: string };
    hint?: string;
};

const SETUP_STEPS: StepData[] = [
    {
        number: 1,
        title: "Open Copilot Chat and select the Designer agent",
        description:
            "Open Copilot Chat (\u2318\u21e7I on Mac \u00b7 Ctrl+Shift+I on Windows/Linux), select the Designer agent from the agent picker, then paste any Figma URL. The Figma MCP server is already configured in this Codespace \u2014 no tokens or secrets needed.",
        prompt:
            "@designer Here\u2019s my design: https://www.figma.com/design/YOUR_FILE_ID/My-Design \u2014 please create a Storybook prototype of the main screen.",
        hint: "Your story appears in this Storybook panel under AI Prototypes the moment it saves.",
    },
    {
        number: 2,
        title: 'If prompted, click "Start server now"',
        description:
            'The first time you ask about a Figma file, Copilot Chat may show a notification that the Figma MCP server needs to start. Click the "Start server now" link that appears directly in the chat — the agent will then connect automatically and continue with your request.',
        hint: "You will only need to do this once per Codespace session. After that, Figma requests work immediately.",
    },
];

function CodeBlock({ children }: { children: string }): JSX.Element {
    return (
        <pre className={styles.code}>
            <code>{children}</code>
        </pre>
    );
}

function PromptBlock({ children }: { children: string }): JSX.Element {
    return (
        <div className={styles.prompt}>
            <span className={styles.promptLabel}>Prompt for Copilot Chat</span>
            <p className={styles.promptText}>{children}</p>
        </div>
    );
}

function StepCard({ step, isLast }: { step: StepData; isLast: boolean }): JSX.Element {
    return (
        <div className={styles.step}>
            <div className={styles.stepAside}>
                <span className={styles.stepBadge}>{step.number}</span>
                {!isLast && <span className={styles.stepLine} />}
            </div>
            <div className={styles.stepBody}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
                {step.code && <CodeBlock>{step.code}</CodeBlock>}
                {step.prompt && <PromptBlock>{step.prompt}</PromptBlock>}
                <div className={styles.stepFooter}>
                    {step.action && (
                        <Button
                            as="a"
                            href={step.action.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            kind="secondary"
                            size="sm"
                        >
                            {step.action.label} ↗
                        </Button>
                    )}
                    {step.hint && <p className={styles.hint}>{step.hint}</p>}
                </div>
            </div>
        </div>
    );
}

function DesignerSetupGuide(): JSX.Element {
    return (
        <div className={styles.canvas}>
            <div className={styles.surface}>
                <header className={styles.header}>
                    <span className={styles.badge}>AI Prototyping Environment</span>
                    <h1 className={styles.headline}>Welcome — you're ready to go 🚀</h1>
                    <p className={styles.lead}>
                        This Codespace connects Figma to a live Storybook via the Designer agent in Copilot Chat.
                        The Figma MCP server is already configured — just open Copilot Chat, paste a Figma URL, and
                        the agent will build an interactive component story for you. No tokens or setup required.
                    </p>
                </header>

                <hr className={styles.divider} />

                <div className={styles.steps}>
                    {SETUP_STEPS.map((step, i) => (
                        <StepCard key={step.number} step={step} isLast={i === SETUP_STEPS.length - 1} />
                    ))}
                </div>

                <footer className={styles.footer}>
                    <p className={styles.footerText}>
                        Generated stories live in{" "}
                        <code className={styles.inlineCode}>packages/shared-components/src/prototypes/ai/</code>. The
                        Designer agent can work with any Figma file — just paste the URL. See{" "}
                        <code className={styles.inlineCode}>docs/ai-prototyping/</code> for the full designer guide.
                    </p>
                </footer>
            </div>
        </div>
    );
}

const meta = {
    title: "AI Prototypes/Get Started",
    component: DesignerSetupGuide,
    parameters: {
        layout: "fullscreen",
    },
    tags: ["autodocs"],
} satisfies Meta<typeof DesignerSetupGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SetupGuide: Story = {};
