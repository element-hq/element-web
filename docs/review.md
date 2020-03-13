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

* Avoid force pushing to a PR after first round of review
* Use merge commits when landing
* PR author merges after review (assuming they have write access)
* Assign issues only when in progress (don’t overly assign things so it’s clear
  that anyone on the team can pick up)

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
