# Review Guidelines

The following summarises review guidelines that we follow for pull requests in
Riot Web and other supporting repos. These are just guidelines (not strict
rules) and may be updated over time.

## Code Review

When reviewing code, here are some things we look for and also things we avoid:

### We review for

* Correctness
* Performance
* Accessibility
* Security
* Comments and documentation where needed
* Sharing knowledge of different areas among the team
* Ensuring it's something we're comfortable maintaining for the long term
* Progress indicators and local echo where appropriate with network activity

### We should avoid

* Style nits that are already handled by the linter
* Dramatically increasing scope

### Good practices

* Use empathetic language
  * See also [Mindful Communication in Code
    Reviews](https://kickstarter.engineering/a-guide-to-mindful-communication-in-code-reviews-48aab5282e5e)
    and [How to Do Code Reviews Like a Human](https://mtlynch.io/human-code-reviews-1/)
* Authors should prefer smaller commits for easier reviewing and bisection
* Reviewers should be explicit about required versus optional changes
  * Reviews are conversations and the PR author should feel comfortable
    discussing and pushing back on changes before making them
* Core team should lead by example through their tone and language
* Take the time to thank and point out good code changes
* Using softer language like "please" and "what do you think?" goes a long way
  towards making others feel like colleagues working towards a common goal

### Workflow

* Authors should request review from the riot-web team by default (if someone on
  the team is clearly the expert in an area, a direct review request to them may
  be more appropriate)
* Reviewers should remove the team review request and request review from
  themselves when starting a review to avoid double review
* If there are multiple related PRs authors should reference each of the PRs in
  the others before requesting review. Reviewers might start reviewing from
  different places and could miss other required PRs.
* Avoid force pushing to a PR after the first round of review
* Use the GitHub default of merge commits when landing (avoid alternate options
  like squash or rebase)
* PR author merges after review (assuming they have write access)
* Assign issues only when in progress to indicate to others what can be picked
  up

## Design and Product Review

We want to ensure that all changes to Riot fit with our design and product
vision. We often request review from those teams so they can provide their
perspective.

In more detail, our usual process for changes that affect the UI or alter user
functionality is:

* For changes that will go live when merged, always flag Design and Product
  teams as appropriate
* For changes guarded by a feature flag, Design and Product review is not
  required (though may still be useful) since we can continue tweaking

As it can be difficult to review design work from looking at just the changed
files in a PR, authors should be prepared for Design and / or Product teams to
request a link to an ad-hoc build of Riot (hosted anywhere) that can be used for
the review. In the future, we [hope to automate
this](https://github.com/vector-im/riot-web/issues/12624) for every PR.

Before starting work on a feature, it's best to ensure your plan aligns well
with our vision for Riot. Please chat with the team in
[#riot-dev:matrix.org](https://matrix.to/#/#riot-dev:matrix.org) before you
start so we can ensure it's something we'd be willing to merge.
