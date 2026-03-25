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
        title: "Get your Figma access token",
        description:
            "Create a personal access token so Copilot can read your Figma files. In Figma: open the main menu \u2192 Account settings \u2192 Security \u2192 Personal access tokens \u2192 Generate new token.",
        action: {
            label: "Open Figma account settings",
            url: "https://www.figma.com/settings",
        },
        hint: "Copy the token immediately \u2014 Figma only shows it once.",
    },
    {
        number: 2,
        title: "Store your token in this Codespace",
        description:
            "Add one Codespace secret called FIGMA_TOKEN so the Figma MCP tools work automatically every time this environment starts. Navigate to GitHub \u2192 Settings \u2192 Codespaces \u2192 Secrets, add the secret, and allow this repository.",
        code: "FIGMA_TOKEN  \u2014 your personal access token",
        action: {
            label: "Open Codespaces secrets",
            url: "https://github.com/settings/codespaces",
        },
        hint: "You only need the token \u2014 the Designer agent extracts the file ID from whatever Figma URL you share.",
    },
    {
        number: 3,
        title: "Paste a Figma URL and go",
        description:
            "Open Copilot Chat (\u2318\u21e7I on Mac \u00b7 Ctrl+Shift+I on Windows/Linux), select the Designer agent from the agent picker, then paste any Figma URL. The agent validates the connection, inspects the file, and builds the story for you.",
        prompt:
            "@designer Here\u2019s my design: https://www.figma.com/design/YOUR_FILE_ID/My-Design \u2014 please create a Storybook prototype of the main screen.",
        hint: "The agent handles any Figma file \u2014 no environment secrets needed per file. Your story appears in this Storybook panel under AI Prototypes the moment it saves.",
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
                    <h1 className={styles.headline}>Welcome — let’s get you set up 🚀</h1>
                    <p className={styles.lead}>
                        This Codespace connects Figma to a live Storybook via the Designer agent in Copilot Chat.
                        Follow the three steps below and you will be translating designs into interactive component
                        stories in minutes — no engineering background required.
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
