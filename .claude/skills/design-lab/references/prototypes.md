# Workflow: Build an app prototype

Use this workflow when the designer wants to wire one or more shared components into the element-web app to demonstrate a feature flow. This is the "live prototype" path — what user-testers and stakeholders click through.

## Branch first

Get the designer onto a **prototype** branch:

```
design/<github-id>/prototype/<slug>
```

If they're not on one, run the "Creating a new design branch" flow in [branching.md](branching.md). Create the branch off `claude-design-lab` (after pulling the latest).

**Important:** if the prototype needs new components that don't exist yet, they should be built on a **separate component branch first**. The reason: components are reusable, and a single component branch can feed multiple prototype variants (e.g. for user-testing A vs B). See the merging-components-into-a-prototype section below.

## Where prototype changes go

Prototype work touches the element-web app:

```
apps/web/src/
```

Plus any new shared components live (as always) in:

```
packages/shared-components/src/
```

…but **only edit shared components if you're on a component branch.** On a prototype branch, you should be **consuming** components, not modifying them. If you need to change a shared component, see "Component change mid-prototype" below.

## Pulling in components from a component branch

When the prototype needs a component that exists on a separate `design/<id>/components/<slug>` branch, the cleanest approach is to **merge that component branch into the prototype branch**:

> Your prototype needs the `AuthButton` component, which lives on `design/davidlangley/components/auth-button`. I'll bring it in by merging that branch into your prototype branch:
>
>   1. Make sure all your prototype work is saved (committed) first
>   2. Merge `design/davidlangley/components/auth-button` into this prototype branch
>
> This keeps the components reusable across prototypes — the component branch stays untouched and other prototypes can pull from it too. Shall I proceed?

```bash
git merge --no-ff design/<github-id>/components/<slug>
```

Use `--no-ff` so the merge is explicit and easy to see in history. If conflicts come up (rare for fresh components), walk the designer through them in plain language.

**Alternative for advanced cases:** `git cherry-pick` specific commits. Don't reach for this unless the designer specifically wants only some commits and is comfortable with the trade-off.

## Wiring the component into the app

To make a component appear in the app, the designer needs to find the right insertion point. Approach this in steps:

**1. Understand the feature.** Ask the designer to describe what flow they want to demo:

> Tell me about the feature — where does it appear in the app, and what does the user see? A couple of sentences is enough.

**2. Find the host file.** Search for the existing screen or component the new piece should live near. Use `grep` or read files like:

- `apps/web/src/components/structures/` — top-level screens
- `apps/web/src/components/views/` — view-level components

Confirm with the designer:

> I think the right place to add this is `apps/web/src/components/structures/RoomView.tsx` — that's the main room screen. Does that match what you're picturing?

**3. Make the edit.** Import the shared component and place it where the designer described:

```tsx
import { AuthButton } from "@element-hq/web-shared-components";

// …somewhere in the render:
<AuthButton label="Continue" onClick={handleContinue} />
```

Keep prototype edits **focused and minimal**. The goal is to demonstrate, not to ship production code. If you find yourself rewriting large sections of the app, pause and ask:

> This is starting to touch a lot of existing code. Just to check — is the goal here a quick demo, or are we trying to land this for real? If demo, we can mock more aggressively; if real, we should probably split this into smaller PRs.

## Multiple variants for user testing

If the designer wants multiple variants of a feature (e.g. for A/B user testing), create **separate prototype branches**:

```
design/davidlangley/prototype/onboarding-variant-a
design/davidlangley/prototype/onboarding-variant-b
```

Both can pull from the same component branches. Don't try to put both variants on one branch with a flag — that defeats the purpose and makes deploys messier.

## Component change mid-prototype

If during prototyping the designer realizes a component needs a change, stop and route them correctly:

> Looks like we need to adjust the `AuthButton` itself (its hover state) — that's a **shared component** change, so it should go on the component branch, not here. Here's what I'd recommend:
>
>   1. Save (commit) any in-progress prototype work on this branch
>   2. Switch to (or create) `design/davidlangley/components/auth-button`
>   3. Make the component change there, save and publish it
>   4. Come back to this prototype branch and merge the updated component in
>
> Shall I walk us through that?

## Verifying in the element-web app

Once the changes are in, start the element-web dev server via the Claude Desktop preview button (port **8080**) so the designer can see their prototype:

```bash
pnpm --filter element-web start
```

See [preview.md](preview.md) for details. After the designer confirms it looks right, offer to save (commit) the work and publish (push) the branch.

## Sharing the prototype

When the prototype is ready to share with stakeholders or testers, offer to deploy it to Netlify with a custom URL slug — see [deploy.md](deploy.md).

## Common pitfalls

- **Editing shared components on a prototype branch.** Don't. Use a component branch and merge in.
- **One big prototype branch with feature flags for variants.** Don't. One branch per variant.
- **Trying to land prototype edits to develop.** Prototype branches stay in the design lab — they're for demos, not production.
- **Skipping save (commit) before merging in a component.** Always commit first; merges into a dirty tree get confusing.
