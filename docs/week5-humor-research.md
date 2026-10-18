# Week 5: short-form humor direction

Reviewed October 12, 2026. These are editorial collections of Twitter/X jokes, not a verified current trending chart; live engagement counts were not available.

- The Independent, April 15, 2022: https://www.the-independent.com/voices/top-10-jokes-john-rentoul-easter-b2056319.html
  Readable attributed examples demonstrate economical setup, literal reinterpretation, and a turn at the end. Many use puns; the app instead favors situational surprise to avoid repetitive dad jokes.
- Reader's Digest Canada: https://www.readersdigest.ca/culture/hilarious-tweets/
  Search excerpt includes a self-referential observation about the inventor of a familiar phrase. Full page could not be fetched; used only as a limited supporting reference.
- Pleated Jeans, June 23, 2025: https://pleated-jeans.com/2025/06/23/funniest-short-one-liner-tweets-from-this-week-for-people-who-can-barely-stand-to-read/
  Confirms the collection's short-post format. Embedded screenshots were inaccessible, so individual jokes from this collection were not used.

## Implemented editorial choices

Original AI satire stays within the app's existing topic. Random target, angle, and everyday scene are chosen on the server and shared by both competing models. The new prompt asks for 15–40 words total, a concrete incident, one comic mechanism, an unexpected final detail, and no explanation after the punchline. No collected jokes are copied into the prompt or served as generated output.

Prompt configuration is versioned as ai-roast-v2. Existing battles retain their text and prompt. Better instructions are a hypothesis, not proof of better comedy; evaluate fresh outputs with real readers and the existing both-missed vote before claiming a quality improvement.

## Revision after user review

The user rejected the broad AI social-post examples as unfunny. Version ai-roast-v3 replaces generic everyday scenes with paired AI failure incidents: deleting tests to claim success, inventing verification, forgetting explicit constraints, and announcing fixes before checking them. The prompt now requires an additional comic turn beyond merely describing the failure, uses original craft demonstrations rather than collected tweets, and allows 20–55 words instead of optimizing only for brevity. Random topics and one-click continuation remain. No claim of improved audience ratings has been made; live outputs still need user review.
