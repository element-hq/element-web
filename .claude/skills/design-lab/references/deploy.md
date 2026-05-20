# Workflow: Deploy a Netlify preview with a custom URL slug

When the designer wants to share their prototype with stakeholders or user-testers, deploy a live preview via the Netlify CLI with a memorable URL slug (e.g. `auth-redesign-v2.netlify.app`).

## Before you deploy — checklist

Always run through this checklist verbally with the designer before deploying. Confirm each one:

> Before I deploy, let me check a few things:
>
>   1. ✅ All your work is **saved (committed)** — no unsaved changes
>   2. ✅ Your branch is **published (pushed) to GitHub**
>   3. ✅ You're on the right branch (`design/<your-id>/prototype/<slug>` — deploys are for prototypes, not for component branches)
>   4. ✅ The element-web app builds successfully
>
> Shall I check these now?

If any are missing, walk through fixing them first:

- **Unsaved changes:** offer save / draft / discard (see [branching.md](branching.md))
- **Not pushed:** offer to publish (push) — first push uses `git push -u origin <branch>`
- **Wrong branch type:** explain that Netlify previews are for prototypes; if they want to preview a component, point them at Storybook

## Verifying the build

Production deploys need a clean build. Run the build first and surface any errors:

```bash
pnpm --filter element-web build
```

If the build fails, stop and surface the error in plain language. Don't deploy a broken build.

> The build failed — there's a type error in `apps/web/src/components/structures/RoomView.tsx`:
>
>   "Property 'label' is missing in type '{}' but required in type 'AuthButtonProps'"
>
> Want me to look at this with you?

## Picking the URL slug

Ask the designer what they'd like the URL to be. Some guidance:

> What should the URL be? Some tips:
>
> - Keep it short and memorable — stakeholders will paste it into Slack
> - Use hyphens, lowercase only
> - Include a hint about what's new (`auth-redesign`, `onboarding-v2`)
> - If you're running A/B variants, include the letter (`onboarding-variant-a`)
>
> So the final URL will be `<your-slug>--<site-name>.netlify.app`. What would you like?

The deploy URL pattern depends on the Netlify site configuration. The most common patterns:

- **Branch alias deploy:** `<slug>--<site-name>.netlify.app` — uses `netlify deploy --alias <slug>`. This is the typical "custom slug" approach.
- **Production deploy on a dedicated preview site:** `<slug>.netlify.app` — only possible if a dedicated Netlify site is set up per prototype, which is rarely worth it.

Default to the **alias deploy** approach (`--alias <slug>`).

## Netlify CLI setup (first-time only)

If the designer has never deployed before, walk through setup:

**1. Check the CLI is installed:**

```bash
netlify --version
```

If not installed, offer to install it via npm:

```bash
npm install -g netlify-cli
```

(Confirm with the designer before installing — they may prefer to install it themselves.)

**2. Check they're logged in:**

```bash
netlify status
```

If not logged in, point them to:

```bash
netlify login
```

(This opens a browser tab — the designer completes the OAuth flow.)

**3. Link the repo to the Netlify site:**

If `.netlify/state.json` doesn't exist locally, run:

```bash
netlify link
```

Walk them through choosing the right Netlify site. If unsure which site to use, ask in your team's Slack first — never guess at production sites.

## Deploying

Once setup is done and the build is clean:

> I'll deploy to Netlify now. Here's what I'll run:
>
>   1. Build the app for production
>   2. Deploy to Netlify with alias `auth-redesign-v2`
>
> This will publish a preview at `auth-redesign-v2--<site-name>.netlify.app`. Shall I proceed?

```bash
pnpm --filter element-web build
netlify deploy --dir=apps/web/dist --alias=<slug>
```

(Adjust `--dir` if the build output is in a different folder — check `apps/web/package.json` or `nx` config to confirm.)

When complete, the CLI prints the deploy URL. Surface it to the designer clearly:

> Done! Your preview is live at:
>
>   **https://auth-redesign-v2--<site-name>.netlify.app**
>
> Anyone with the link can view it. The deploy will stick around as long as you don't reuse the alias. Want me to also paste this into a save (commit) message so you have a record?

## Re-deploying after updates

When the designer makes further changes and wants to re-deploy:

1. Make sure changes are saved (committed) and published (pushed).
2. Re-run the build + deploy with the same alias — it overwrites the previous deploy at that URL.

```bash
pnpm --filter element-web build
netlify deploy --dir=apps/web/dist --alias=<slug>
```

The URL stays the same, which is exactly what you want for sharing with stakeholders.

## Production deploy (`--prod`)

**Don't** use `netlify deploy --prod` unless the designer explicitly asks for a production deploy and you've confirmed they understand it will overwrite the main site. The default `--alias` flow is what they want for previews. If they ask for `--prod`, double-check:

> Just to make sure — `--prod` will publish this to the **main** Netlify site, overwriting whatever's currently there. Alias deploys (the default for design-lab previews) are usually what you want for sharing. Are you sure you want a production deploy?

## Cleaning up old deploys

The aliases stick around indefinitely. If the designer is done with a prototype:

```bash
netlify api deleteSiteDeploy --data '{"deploy_id":"<id>"}'      # advanced — usually leave alone
```

Most teams just let old aliases linger. Don't proactively offer to clean up — it's destructive and rarely worth the time. Only do it if the designer explicitly asks.

## Common pitfalls

- **Deploying with unsaved changes.** The local files exist, but only what's committed shapes what builds. Always save (commit) first.
- **Building before checking types/tests.** A `tsc` or test failure won't always break the Netlify build, but a runtime issue will surface for testers. Suggest a quick check:
  ```bash
  pnpm --filter element-web typecheck    # if this script exists
  ```
- **Using `--prod` by accident.** Always default to `--alias`.
- **Skipping the link step.** First-time deploys without `netlify link` fail confusingly. Run `netlify status` first.
- **Reusing an alias across unrelated work.** Each prototype gets its own slug. Don't recycle `prototype-1` for three different things.
