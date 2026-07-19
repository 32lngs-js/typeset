# Why TypeSet Exists

## The gap

AI coding agents are good at implementing changes. They are not good at knowing what the change should feel like.

When you tell an agent "make the heading a bit bigger," it picks a number. Maybe 2px. Maybe 4px. It has no access to your eye. You review, say "a bit more," and the loop repeats — three, four, five rounds — until it lands somewhere near what you could have specified in ten seconds if you'd had a scrubber in front of you.

TypeSet is that scrubber. You interact with the live element, in the real page, until the value feels right. Then you copy the CSS and hand it to the agent — or to Agentation, which packages it with the selector and file context so the agent can apply it exactly once, correctly.

## The centroid problem

A base language model is, at its core, a compression of roughly all human text. Not a library — a compression. It stores the shape of patterns, the statistical weight of what humans have written, not the writing itself. When you prompt it, it does not retrieve; it reconstructs. And what it reconstructs trends toward the center of mass of everything it was trained on.

Ted Chiang called this a "blurry JPEG of the web." The mechanism is more precise: language models are trained to predict the most probable next token given context. The most probable output is the mode — the statistical centroid of what humans most often wrote next, given similar context. Slop is the centroid. It reads generic because "most probable next token, averaged over humanity" is definitionally generic.

Every prompt you write is you dragging the output off the mean toward your particular creative vision. Each iteration, you're fighting gravity.

Francis Galton discovered the visual version of this in the 1880s: average many faces through composite photography and you get a face that is technically attractive — symmetrical, proportionate — and entirely without character. AI-generated design has the same property: competent, coherent, unmemorable. What makes a design distinctive is precisely the idiosyncratic choices that depart from the mean. Those choices, by definition, live in low-probability space.

This is where the scrubber model breaks the problem differently. You are not asking the model to navigate from the centroid to your particular creative vision. You navigate there yourself, through direct interaction with the live element. The model never enters the picture until the value is already resolved. What you hand it is not a description of a feeling or a direction to travel — it is a coordinate. Apply this. The centroid problem disappears because you bypassed the generative step entirely.

## Design as a quality signal

The brain does not wait for conscious analysis to evaluate quality. It does it in milliseconds, automatically, using signals accumulated over a lifetime of exposure to well-made and poorly-made things.

Fashion is the clearest example outside of screens. The difference between a cheap garment and an expensive one is rarely one obvious thing. It is the stitching weight, the hem finish, the button placement, how the fabric drapes when it moves, the precision of the cut at the shoulders. You often cannot articulate it. You just know. The brain is reading dozens of micro-signals in parallel, cross-referencing against pattern libraries built from years of handling things. The assessment is done before language can reach it.

The same hardware runs on designed interfaces. When you open a product and something feels considered — the spacing generous in exactly the right proportion, the type weight carrying the right authority for the hierarchy, the line height giving text room to breathe — that impression forms before you read a word. Stanford researchers found that web credibility assessments form within 50ms of first exposure. Trustworthiness judgments take around 100ms. These are pre-linguistic. You are not deciding; your visual system is reporting back.

What it is reading for is intentionality. The signal of quality in a designed artifact is not beauty in the abstract. It is the sense that someone made specific choices — that nothing is there by accident, and nothing is default. Deliberate padding communicates: *this was considered*. A font at weight 450 rather than 400 or 500 is someone who wanted exactly 450, not someone who left the slider at its resting position. Letter-spacing at -0.01em on a heading is a choice that required the designer to have an opinion about -0.01em, which means they had an eye, which means this was made.

Gestalt psychology named the underlying principle: the whole carries information the parts do not. Every micro-decision either reinforces the sense that the whole is intentional or subtly corrodes it. A margin that is two pixels off the grid, a line height that is the default rather than the considered value, a font weight that is whatever the system chose — these do not register individually. They accumulate. The brain does not flag them consciously. It just returns a lower quality score.

This is the structural problem with AI-generated design. Centroid outputs are, by definition, the aggregate of what everyone who has ever designed anything chose when they were not being particularly deliberate. They are the default. The statistically average padding is not wrong — it is exactly what an AI will produce and exactly what no intentional designer would leave unchanged. The brain, encountering a page built from centroid choices, reads it correctly: these are the default values. This was not made; it was generated.

As AI-generated content saturates the environment, these micro-signals will become a more reliable differentiator, not less. The brain learns from exposure. Every page that looks generated trains a faster, more accurate pattern match. The products that feel handmade will feel that way specifically because of the low-probability choices in them — the places where someone scrubbed a value to where their eye said stop, rather than where the model's prior said probably. Those choices are not decorative. They are proof of presence.

## Who this is for

There used to be a clear path for designers who cared about the details: learn enough CSS to tweak values directly, or open Chrome's inspector, find the element, edit the computed style, and see it update live. It was not elegant but it worked. The designer stayed in control of the value, the browser gave instant feedback, and the result was as precise as their eye.

That path assumed a designer who could read and write a little code, or at minimum navigate DevTools without fear. A large share of the people building products today cannot do that, and increasingly do not need to — they use agents for implementation. These are not hobbyists or early adopters. They are a distinct and growing class of builder: product-minded, design-literate, shipping real things, and entirely reliant on agents to translate their intent into code.

For this class of builder, design is not a nice-to-have. It is often the primary differentiator. A polished product built without a single line of hand-written code is entirely achievable; a sloppy product is not forgiven because an AI wrote it. Users do not see the stack. They see the type, the spacing, the weight, the rhythm. If it looks like it was generated and left unchecked, that is what they remember.

The problem is that the old path — edit CSS directly, see it live — is closed to them. And the new path — describe what you want to an agent, get an implementation back — loses resolution at exactly the layer where design lives. The agent's guess at "a bit tighter" is not their eye. And they cannot open DevTools to correct it.

TypeSet is built for this gap. It gives a designer-class sensory interface to someone who does not write CSS — drag a label, watch the type change, stop when it looks right, copy the output. No inspector, no field editing, no hypothesis formation. Just the judgment, the result, and a value precise enough to hand off.

## Why high-resolution detail still requires a human

There is a class of design decision that cannot be delegated to an agent, not because the agent lacks capability, but because the decision has no specification. It is not resolvable by logic. It is resolved by looking.

Typography is almost entirely in this class. The difference between `line-height: 1.45` and `line-height: 1.5` is not a correctness question. It is a question about rhythm, about how the eye moves down a column of text, about whether the paragraph breathes or crowds. The right answer depends on the font, the size, the column width, the surrounding space, and the reader's expectation — a context that is entirely visual and entirely situational. No amount of instruction to an agent makes this a computable output.

This is not a temporary limitation of current AI. It is structural. Aesthetic judgment at fine resolution requires sensory feedback. You have to see the thing as it changes to know when to stop. An agent operating from a text prompt cannot get that feedback because it does not have eyes in the browser. It takes a turn, commits output, and waits for you to evaluate it. That evaluation cycle — the round trip between "apply" and "review" — is where the slowness lives. And fine-grained visual decisions often require many rounds.

The demand for manual tweaking is not a sign that AI has not matured enough. It is a sign that some decisions are inherently sensory and the right tool for them is one that puts the human's hand on the dial.

## Why verbal communication with an agent fails for this

The obvious alternative to a scrubber is language. Describe what you want; let the agent interpret.

This fails at the resolution that design decisions require, and it fails for a specific reason: natural language does not have the granularity to specify visual quantities. "A little tighter" is not a number. "More breathing room" is not a value. "It feels heavy" does not encode the delta between `font-weight: 500` and `font-weight: 450`. Even when you use precise language ("increase the letter-spacing by 0.01em"), you are working by hypothesis — you have formed a number in your head without yet seeing it, and the round trip to review it costs time and interrupts the visual judgment you're trying to exercise.

There is also an interpretation layer that introduces noise. "Slightly more elegant" means one thing to you and another to the model. The agent's choice of how to implement an aesthetic instruction is itself a judgment call — and it is not yours. Every degree of language abstraction between you and the output is a place where your intent can diverge from the result.

Verbal communication with an agent is the right mode for structural changes: move this section, add a component, refactor this logic. These are changes where the intent can be fully encoded in a sentence. Typography refinement is not in this category. The intent is a felt sense, not a sentence. The right tool for felt senses is one that lets you feel it in real time.

## Where TypeSet sits in the flow

```
Human taste                                          Code
    |                                                  |
    v                                                  v
[ TypeSet ]  ——  Copy CSS  ——>  [ Agentation / agent ]
live scrub                      structured handoff
find the value                  implement the value
```

The problem TypeSet solves is upstream of Agentation's problem. Agentation answers "how do I tell the agent precisely *what* to touch" — selectors, component paths, file locations. TypeSet answers "how do I know *what value* to give it."

Without TypeSet, you're authoring feedback in words ("a little heavier," "tighter tracking"). Words are lossy. An agent translating words into numbers introduces a guess at every step. That guess is rarely right on the first try, and the correction loop is slower than it looks — each round is a generate-review-redirect cycle, not a keystroke.

With TypeSet, the value is already resolved before the agent enters the picture. You hand it `font-size: 19px; letter-spacing: -0.02em; line-height: 1.45` — not a description of a feeling. The agent's job collapses to "apply this" rather than "interpret this and guess."

## Why a separate tool at all

The natural question is: why not just edit the CSS directly in DevTools?

DevTools works. But it does one thing TypeSet is designed around: **scrubbing with physical drag gestures on the value label**, not typing numbers into fields and tabbing out. The cognitive mode is different. Dragging lets you follow the feeling — you watch the type as you move, and stop when it looks right. Typing requires you to form a hypothesis first ("let me try 18"), evaluate, form another, try it. It's slower and it interrupts the visual judgment you're trying to exercise.

TypeSet also scopes the interface to typography specifically — size, weight, line height, letter spacing, family, position — with a curated font library and one-click copy. DevTools gives you everything and is optimized for debugging, not for making decisions about type.

## The Agentation workflow and what it reveals

[Agentation](https://agentation.com) is an annotation layer on top of the browser. Click an element, add a note, and it captures structured context: CSS selector, React component path, file location, computed styles, and your feedback. Export that block to Claude Code or Cursor and the agent has a precise map — not "the blue button in the sidebar" but the actual selector, the file path, and exactly what to change.

This is a meaningful advance over raw text prompts. The agent's implementation problem is largely solved — it knows where in the codebase to go and can apply changes without guessing at structure. But the workflow exposes a distinct upstream problem: before you can annotate, you have to know what value to annotate with. Agentation captures decisions; it does not help you make them.

The natural workflow that emerges from these tools taken together has a clear three-phase shape:

**Phase 1: Visual exploration.** Live interaction with the real element on the real page. No code changes, no file writes — just a human with a scrubber, watching the type respond. This is the sensory phase. The goal is to find the value, not to apply it. TypeSet.

**Phase 2: Structured handoff.** The resolved values get packaged with the technical context the agent needs. Selector, file path, component hierarchy, the exact CSS block to apply. This is the translation layer — human judgment converted into machine-actionable instructions. Agentation, or a copy-paste directly to Claude Code.

**Phase 3: Agent implementation.** The agent applies the change. Its input is fully specified, so the task is deterministic. No interpretation, no aesthetic judgment delegated to the model. One round trip, correct output. Claude Code, Cursor, or any agent with file access.

The key insight is that each phase has a different primary actor. Phase 1 is human-led — the agent would make it worse, not better. Phase 2 is a bridge. Phase 3 is agent-led — the human would make it slower, not better. Tools that try to collapse all three phases into one produce a worse result in every phase: they either force the human to specify values without seeing them, or they let the agent make aesthetic decisions it cannot make well.

The intended pairing for TypeSet and Agentation is:

1. Open TypeSet — click the element, scrub until it feels right, lock in the values
2. Copy CSS from TypeSet — exact values, no ambiguity
3. Open Agentation — click the same element, paste the CSS into the annotation alongside a plain-language note
4. Export to the agent — it implements with the selector, file path, and the exact values in hand

Or without Agentation: paste the CSS block directly into Claude Code with a one-line note ("apply to .heading in globals.css"). The agent does not need to guess anything.

## What comes next

The three-phase shape points toward a natural next step: a tool that collapses the handoff. Right now the bridge between Phase 1 and Phase 3 is manual — copy CSS, open a different tool or chat, paste, describe the target. That friction is small but present.

A tighter version of this workflow would have the scrubber aware of the selector and file path from the start. Inspect the element, scrub to find the value, and the export is already a diff — not a CSS block you paste, but a file change you approve. The human's role stays unchanged: sensory judgment, stopping the scrubber at the right value. The agent's role stays unchanged: write the file. What disappears is the middle step where you manually carry the resolved value from one tool to another.

This is not far from what Agentation's MCP integration already sketches — an agent that listens to the annotation stream and applies changes in real time, asking clarifying questions through a conversational interface. The evolution from there is to close the loop entirely: the agent watches the scrubber, sees when you stop, and writes the file. Preview is live in the browser because it was always live; the commit is the only new step.

That version of the tool is still a human-in-the-loop system. The human still drags the slider. The agent still writes the code. What changes is latency: the handoff becomes a gesture rather than a workflow. The distinction between exploring and implementing narrows to the moment you lift your finger.

## What TypeSet deliberately does not do

TypeSet does not implement changes. It does not write to files. It does not talk to agents. It makes inline style edits to the live DOM — edits that reset on reload — so there is no ambiguity about what is permanent and what is exploratory.

This boundary is intentional. The moment TypeSet writes to files, it becomes a different kind of tool with different failure modes (race conditions with the agent, unclear ownership of the stylesheet, undo semantics). The clean handoff — Copy CSS, paste somewhere else — keeps the roles separate: TypeSet owns the visual judgment phase, the agent owns the implementation phase.

## Summary

Most typography decisions happen in code. The design tool is disconnected from the real page; DevTools is optimized for debugging, not deciding; and AI agents can implement but cannot see. Natural language has no resolution fine enough to specify the difference between `1.45` and `1.5` line height on a real page with a real font. And every round trip through an agent costs more than dragging a slider costs.

TypeSet is the sensory layer that sits before the handoff. It resolves the value — not by hypothesis, not by instruction, but by direct interaction with the live element. The output is a CSS block precise enough that an agent can apply it without interpretation. Combined with a handoff tool like Agentation, the full workflow becomes: human finds the value, agent implements it, one round trip, correct result.

The deeper claim is about how work should be divided between humans and agents. Agents are fast, precise, and tireless at the implementation layer. Humans are the only ones who can feel when something looks right. The right division is not "agent does more" or "human stays in control" — it is "each actor operates in the phase where they have an advantage." TypeSet makes that division concrete: the scrubber is the human's instrument, the diff is the agent's instrument, and the handoff between them is as tight as it can be without collapsing the distinction.
